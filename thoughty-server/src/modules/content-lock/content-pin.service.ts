import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ContentPin, User } from '@/database/entities';
import { apiError } from '@/common/errors';
import { TooManyPinAttemptsException, holdsLockedContent } from '@/common/content-lock';
import { TwoFactorService } from '@/modules/auth/services/two-factor.service';
import type { TwoFactorChallengeResponseDto } from '@/modules/auth/dto';
import type { ContentPinProofDto } from './dto';

/** Wrong PINs allowed before each further one blocks tries for a while. */
export const FREE_PIN_ATTEMPTS = 5;
/** The first lockout; each wrong PIN after it doubles the wait, up to `MAX_PIN_LOCKOUT_MS`. */
const FIRST_PIN_LOCKOUT_MS = 60 * 1000;
const MAX_PIN_LOCKOUT_MS = 24 * 60 * 60 * 1000;
const PIN_HASH_COST = 12;

/**
 * How long tries are blocked after `failedAttempts` wrong PINs in a row: not at all for the first four,
 * then one minute after the fifth, two after the sixth, four after the seventh… up to a day. Ten
 * thousand PINs then take decades to try.
 */
export function pinLockoutMs(failedAttempts: number): number {
  if (failedAttempts < FREE_PIN_ATTEMPTS) return 0;
  return Math.min(FIRST_PIN_LOCKOUT_MS * 2 ** (failedAttempts - FREE_PIN_ATTEMPTS), MAX_PIN_LOCKOUT_MS);
}

type PinCheck = 'right' | 'wrong' | 'blocked' | 'missing';

/**
 * The writer's PIN: setting it, changing or removing it with a proof, and checking it. The wrong tries
 * are counted in the database, one check at a time per writer (the row is locked while bcrypt runs), so
 * neither a restart nor parallel requests reset or skip the lockout. The PIN itself is never logged.
 */
@Injectable()
export class ContentPinService {
  constructor(
    @InjectRepository(ContentPin)
    private readonly pinRepository: Repository<ContentPin>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly twoFactor: TwoFactorService,
  ) {}

  find(userId: number): Promise<ContentPin | null> {
    return this.pinRepository.findOne({ where: { userId } });
  }

  /** Refuses locking a diary or entry before the writer has a PIN to unlock it with (409). */
  async assertPinSet(userId: number): Promise<void> {
    if (!(await this.pinRepository.exists({ where: { userId } }))) {
      throw apiError(ConflictException, 'CONTENT_PIN_NOT_SET');
    }
  }

  /**
   * Checks a PIN, counting a wrong one: 403 `CONTENT_PIN_INCORRECT`, or 429 `CONTENT_PIN_BLOCKED` once
   * wrong ones have blocked tries (also while they are blocked, without checking). A right PIN clears
   * the count.
   */
  async verify(userId: number, pin: string, now = new Date()): Promise<void> {
    const outcome = await this.dataSource.transaction(async (manager): Promise<PinCheck> => {
      const pins = manager.getRepository(ContentPin);
      const row = await pins.findOne({ where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (!row) return 'missing';
      if (row.blockedUntil && row.blockedUntil > now) return 'blocked';
      if (await bcrypt.compare(pin, row.pinHash)) {
        if (row.failedAttempts > 0 || row.blockedUntil) {
          await pins.update({ userId }, { failedAttempts: 0, blockedUntil: null });
        }
        return 'right';
      }
      const failedAttempts = row.failedAttempts + 1;
      const wait = pinLockoutMs(failedAttempts);
      await pins.update({ userId }, { failedAttempts, blockedUntil: wait ? new Date(now.getTime() + wait) : null });
      return wait ? 'blocked' : 'wrong';
    });
    if (outcome === 'missing') throw apiError(ConflictException, 'CONTENT_PIN_NOT_SET');
    if (outcome === 'blocked') throw apiError(TooManyPinAttemptsException, 'CONTENT_PIN_BLOCKED');
    if (outcome === 'wrong') throw apiError(ForbiddenException, 'CONTENT_PIN_INCORRECT');
  }

  /**
   * Sets the writer's PIN. A first PIN needs nothing more; replacing one needs a proof (see `prove`),
   * which may first answer with an emailed-code challenge. The wrong-try count starts over.
   */
  async set(userId: number, pin: string, proof: ContentPinProofDto): Promise<TwoFactorChallengeResponseDto | null> {
    if (await this.pinRepository.exists({ where: { userId } })) {
      const challenge = await this.prove(userId, proof);
      if (challenge) return challenge;
    }
    const pinHash = await bcrypt.hash(pin, PIN_HASH_COST);
    await this.pinRepository.upsert({ userId, pinHash, failedAttempts: 0, blockedUntil: null }, ['userId']);
    return null;
  }

  /** Removes the PIN with a proof; every lock goes with it, since nothing could unlock it any more. */
  async remove(userId: number, proof: ContentPinProofDto): Promise<TwoFactorChallengeResponseDto | null> {
    if (!(await this.pinRepository.exists({ where: { userId } }))) {
      throw apiError(ConflictException, 'CONTENT_PIN_NOT_SET');
    }
    const challenge = await this.prove(userId, proof);
    if (challenge) return challenge;
    await this.dataSource.transaction(async (manager) => {
      await manager.query('UPDATE diaries SET is_locked = false WHERE user_id = $1 AND is_locked', [userId]);
      await manager.query('UPDATE entries SET is_locked = false WHERE user_id = $1 AND is_locked', [userId]);
      await manager.getRepository(ContentPin).delete({ userId });
    });
    return null;
  }

  /** Whether any of the writer's diaries or entries (the recycle bin included) is locked. */
  hasLockedContent(userId: number): Promise<boolean> {
    return holdsLockedContent(this.dataSource, userId);
  }

  /**
   * Proves the writer may change, remove or reset the PIN: the current PIN (a wrong one counts as a try),
   * or the account password; then, when two-factor authentication is on, or for an account without a
   * password, the emailed code. Without a code yet, it emails one and returns its challenge.
   */
  private async prove(userId: number, proof: ContentPinProofDto): Promise<TwoFactorChallengeResponseDto | null> {
    if (proof.currentPin) {
      await this.verify(userId, proof.currentPin);
      return null;
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw apiError(NotFoundException, 'USER_NOT_FOUND');
    if (user.passwordHash) {
      if (!proof.password) throw apiError(BadRequestException, 'CONTENT_PIN_PROOF_REQUIRED');
      if (!(await bcrypt.compare(proof.password, user.passwordHash))) {
        throw apiError(UnauthorizedException, 'AUTH_INVALID_PASSWORD');
      }
      if (!user.twoFactorEnabled) return null;
    }
    if (proof.challengeToken && proof.code) {
      await this.twoFactor.consumeContentPinChallenge(userId, { challengeToken: proof.challengeToken, code: proof.code });
      return null;
    }
    return this.twoFactor.startContentPinChallenge(user);
  }
}

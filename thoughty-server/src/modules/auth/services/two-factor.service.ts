import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { apiError } from '@/common/errors';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { User } from '@/database/entities';
import {
  TwoFactorChallengeResponseDto,
  TwoFactorCodeDto,
  TwoFactorStatusResponseDto,
} from '../dto';
import { EmailService } from './email.service';
import { getTwoFactorSecret } from '../auth-secrets';

type TwoFactorPurpose = 'login' | 'enable';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_TTL_SECONDS = CHALLENGE_TTL_MS / 1000;

@Injectable()
export class TwoFactorService {
  private readonly challengeSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.challengeSecret = getTwoFactorSecret(this.configService);
  }

  private tokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private codeHash(code: string): string {
    return crypto.createHmac('sha256', this.challengeSecret).update(code).digest('hex');
  }

  private codesMatch(providedCode: string, expectedHash: string): boolean {
    const providedHash = Buffer.from(this.codeHash(providedCode), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      providedHash.length === expected.length && crypto.timingSafeEqual(providedHash, expected)
    );
  }

  private assertEligible(user: User, purpose: TwoFactorPurpose): void {
    if (user.authProvider !== 'local' || !user.passwordHash) {
      throw apiError(BadRequestException, 'AUTH_2FA_PASSWORD_ACCOUNTS_ONLY');
    }
    if (!user.emailVerified) {
      throw apiError(BadRequestException, 'AUTH_2FA_EMAIL_NOT_VERIFIED');
    }
    if (purpose === 'enable' && user.twoFactorEnabled) {
      throw apiError(BadRequestException, 'AUTH_2FA_ALREADY_ENABLED');
    }
    if (purpose === 'login' && !user.twoFactorEnabled) {
      throw apiError(BadRequestException, 'AUTH_2FA_NOT_ENABLED');
    }
    if (!this.emailService.isConfigured()) {
      throw apiError(ServiceUnavailableException, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    }
  }

  async startChallenge(
    user: User,
    purpose: TwoFactorPurpose,
  ): Promise<TwoFactorChallengeResponseDto> {
    this.assertEligible(user, purpose);
    const challengeToken = crypto.randomBytes(32).toString('hex');
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    user.twoFactorChallengeTokenHash = this.tokenHash(challengeToken);
    user.twoFactorChallengeCodeHash = this.codeHash(code);
    user.twoFactorChallengePurpose = purpose;
    user.twoFactorChallengeExpires = new Date(Date.now() + CHALLENGE_TTL_MS);
    await this.userRepository.save(user);

    try {
      await this.emailService.sendTwoFactorCodeEmail(user.email, code, CHALLENGE_TTL_SECONDS / 60);
    } catch {
      await this.clearChallenge(user.id, user.twoFactorChallengeTokenHash);
      throw apiError(ServiceUnavailableException, 'AUTH_2FA_CODE_NOT_SENT');
    }

    return {
      twoFactorRequired: true,
      challengeToken,
      expiresInSeconds: CHALLENGE_TTL_SECONDS,
    };
  }

  async startSetup(userId: number): Promise<TwoFactorChallengeResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw apiError(UnauthorizedException, 'USER_NOT_FOUND');
    }
    return this.startChallenge(user, 'enable');
  }

  async resend(challengeToken: string): Promise<TwoFactorChallengeResponseDto> {
    const user = await this.findChallenge(challengeToken);
    return this.startChallenge(user, user.twoFactorChallengePurpose as TwoFactorPurpose);
  }

  private async findChallenge(
    challengeToken: string,
    purpose?: TwoFactorPurpose,
    userId?: number,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        twoFactorChallengeTokenHash: this.tokenHash(challengeToken),
        twoFactorChallengeExpires: MoreThan(new Date()),
        ...(purpose ? { twoFactorChallengePurpose: purpose } : {}),
        ...(userId ? { id: userId } : {}),
      },
    });
    if (!user?.twoFactorChallengeCodeHash || !user.twoFactorChallengePurpose) {
      throw apiError(UnauthorizedException, 'AUTH_2FA_INVALID_CHALLENGE');
    }
    return user;
  }

  private async clearChallenge(userId: number, tokenHash: string): Promise<boolean> {
    const result = await this.userRepository.update(
      { id: userId, twoFactorChallengeTokenHash: tokenHash },
      {
        twoFactorChallengeTokenHash: null,
        twoFactorChallengeCodeHash: null,
        twoFactorChallengePurpose: null,
        twoFactorChallengeExpires: null,
      },
    );
    return result.affected === 1;
  }

  private clearChallengeFields(user: User): void {
    user.twoFactorChallengeTokenHash = null;
    user.twoFactorChallengeCodeHash = null;
    user.twoFactorChallengePurpose = null;
    user.twoFactorChallengeExpires = null;
  }

  private async consumeChallenge(
    dto: TwoFactorCodeDto,
    purpose: TwoFactorPurpose,
    userId?: number,
  ): Promise<User> {
    const user = await this.findChallenge(dto.challengeToken, purpose, userId);
    if (!this.codesMatch(dto.code, user.twoFactorChallengeCodeHash!)) {
      throw apiError(UnauthorizedException, 'AUTH_INVALID_2FA_CODE');
    }
    if (!(await this.clearChallenge(user.id, this.tokenHash(dto.challengeToken)))) {
      throw apiError(UnauthorizedException, 'AUTH_2FA_CHALLENGE_USED');
    }
    this.clearChallengeFields(user);
    return user;
  }

  async consumeLogin(dto: TwoFactorCodeDto): Promise<User> {
    const user = await this.consumeChallenge(dto, 'login');
    if (!user.twoFactorEnabled || user.deletedAt) {
      throw apiError(UnauthorizedException, 'AUTH_2FA_UNAVAILABLE');
    }
    return user;
  }

  async enable(userId: number, dto: TwoFactorCodeDto): Promise<{ success: boolean }> {
    const user = await this.consumeChallenge(dto, 'enable', userId);
    user.twoFactorEnabled = true;
    await this.userRepository.save(user);
    return { success: true };
  }

  async disable(userId: number, password: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw apiError(UnauthorizedException, 'AUTH_INVALID_PASSWORD');
    }
    user.twoFactorEnabled = false;
    user.twoFactorChallengeTokenHash = null;
    user.twoFactorChallengeCodeHash = null;
    user.twoFactorChallengePurpose = null;
    user.twoFactorChallengeExpires = null;
    await this.userRepository.save(user);
    return { success: true };
  }

  async status(userId: number): Promise<TwoFactorStatusResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw apiError(UnauthorizedException, 'USER_NOT_FOUND');
    }
    return {
      enabled: user.twoFactorEnabled,
      available: this.emailService.isConfigured() && user.authProvider === 'local',
      emailVerified: user.emailVerified,
    };
  }
}

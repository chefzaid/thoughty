import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
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
    this.challengeSecret = this.configService.get<string>(
      'TWO_FACTOR_SECRET',
      `${this.configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production')}:two-factor`,
    );
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
      throw new BadRequestException(
        'Email two-factor authentication is available for password accounts only.',
      );
    }
    if (!user.emailVerified) {
      throw new BadRequestException('Verify your email before enabling two-factor authentication.');
    }
    if (purpose === 'enable' && user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled.');
    }
    if (purpose === 'login' && !user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled.');
    }
    if (!this.emailService.isConfigured()) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
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
      throw new ServiceUnavailableException('Unable to send the verification code.');
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
      throw new UnauthorizedException('User not found');
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
      throw new UnauthorizedException('Invalid or expired two-factor challenge.');
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
      throw new UnauthorizedException('Invalid or expired verification code.');
    }
    if (!(await this.clearChallenge(user.id, this.tokenHash(dto.challengeToken)))) {
      throw new UnauthorizedException('Two-factor challenge has already been used.');
    }
    this.clearChallengeFields(user);
    return user;
  }

  async consumeLogin(dto: TwoFactorCodeDto): Promise<User> {
    const user = await this.consumeChallenge(dto, 'login');
    if (!user.twoFactorEnabled || user.deletedAt) {
      throw new UnauthorizedException('Two-factor authentication is unavailable.');
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
      throw new UnauthorizedException('Invalid password');
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
      throw new UnauthorizedException('User not found');
    }
    return {
      enabled: user.twoFactorEnabled,
      available: this.emailService.isConfigured() && user.authProvider === 'local',
      emailVerified: user.emailVerified,
    };
  }
}

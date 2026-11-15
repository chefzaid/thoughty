import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, Diary } from '@/database/entities';
import { sanitizeString } from '@/common/utils';
import {
  RegisterDto,
  LoginDto,
  OAuthDto,
  TwoFactorChallengeResponseDto,
  TwoFactorCodeDto,
} from '../dto';
import { assertHumanAuthAttempt } from './auth-bot-protection';
import { TwoFactorService } from './two-factor.service';
import { AuthSessionService, type IssuedSession } from './auth-session.service';
import { IdentityVerificationService } from './identity-verification.service';
import { ProviderAccountService } from './provider-account.service';
import { defaultDiaryFor } from './default-diary';

/**
 * A bcrypt hash (cost 12, like real password hashes) of a random throwaway password. It is
 * compared when an account has no usable password hash, so unknown, deleted, and password-less
 * accounts take as long to reject as a wrong password.
 */
const TIMING_EQUALIZER_HASH = '$2b$12$HlgReIVskPRRIFDGvS47oeqqKbNUqNQAzAUD8AR1l9NSG1SKXl7Mq';

/**
 * Signing in: registration without email verification (only where no mail server is configured,
 * outside production; see `SignUpService`) and password login (with the two-factor step), and
 * Google and Keycloak sign-in, whose account `ProviderAccountService` finds, links or creates.
 * Each ends in a new session from `AuthSessionService`; a new account gets its default diary.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly sessionService: AuthSessionService,
    private readonly identityVerification: IdentityVerificationService,
    private readonly twoFactorService: TwoFactorService,
    private readonly providerAccounts: ProviderAccountService,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedSession> {
    assertHumanAuthAttempt(dto.website);

    const sanitizedUsername = dto.username
      ? sanitizeString(dto.username.trim()).substring(0, 50)
      : null;

    // Generate username from email if not provided
    const username = sanitizedUsername || dto.email.split('@')[0].substring(0, 50);

    // Check if email exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw apiError(ConflictException, 'AUTH_EMAIL_TAKEN');
    }

    // Check if username exists
    const existingUsername = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUsername) {
      throw apiError(ConflictException, 'AUTH_USERNAME_TAKEN');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.userRepository.save({
      username,
      email: dto.email.toLowerCase(),
      passwordHash,
      authProvider: 'local',
      emailVerified: false,
    });

    await this.createDefaultDiary(user.id);

    return this.sessionService.createSession(user);
  }

  async login(dto: LoginDto): Promise<IssuedSession | TwoFactorChallengeResponseDto> {
    assertHumanAuthAttempt(dto.website);

    const identifier = sanitizeString(dto.identifier.trim()).toLowerCase();

    // Find user by email or username
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :identifier OR LOWER(user.username) = :identifier', {
        identifier,
      })
      .getOne();

    // Unknown, deleted, and password-less accounts are rejected exactly like a wrong password,
    // after the same bcrypt work, so the response does not reveal which accounts exist.
    const usableHash = user && !user.deletedAt && user.passwordHash ? user.passwordHash : null;
    const validPassword = await bcrypt.compare(dto.password, usableHash ?? TIMING_EQUALIZER_HASH);
    if (!user || !usableHash || !validPassword) {
      throw apiError(UnauthorizedException, 'AUTH_INVALID_CREDENTIALS');
    }

    if (user.twoFactorEnabled) {
      return this.twoFactorService.startChallenge(user, 'login');
    }

    return this.sessionService.createSession(user);
  }

  async verifyTwoFactorLogin(dto: TwoFactorCodeDto): Promise<IssuedSession> {
    return this.sessionService.createSession(await this.twoFactorService.consumeLogin(dto));
  }

  async oauthLogin(dto: OAuthDto): Promise<IssuedSession> {
    const { sub, email, name, picture } = await this.identityVerification.verifyGoogleCredential(
      dto.credential,
    );
    const { user, isNewUser } = await this.providerAccounts.signIn({
      provider: 'google',
      subject: sub,
      email,
      suggestedUsername: name,
      avatarUrl: picture,
    });
    return this.sessionService.createSession(user, isNewUser);
  }

  async keycloakLogin(accessToken?: string): Promise<IssuedSession> {
    const { subject, email, preferredUsername } =
      await this.identityVerification.verifyKeycloakAccessToken(accessToken);
    const { user, isNewUser } = await this.providerAccounts.signIn({
      provider: 'keycloak',
      subject,
      email,
      suggestedUsername: preferredUsername,
    });
    return this.sessionService.createSession(user, isNewUser);
  }

  private async createDefaultDiary(userId: number): Promise<void> {
    await this.diaryRepository.save(defaultDiaryFor(userId));
  }
}

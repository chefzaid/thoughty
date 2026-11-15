import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '@/database/entities';
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
import { saveNewAccount } from './default-diary';
import {
  freeUsername,
  takenConflict,
  uniqueViolationOf,
  usernameTaken,
  USERNAME_MAX_LENGTH,
} from './free-username';

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
    private readonly dataSource: DataSource,
    private readonly sessionService: AuthSessionService,
    private readonly identityVerification: IdentityVerificationService,
    private readonly twoFactorService: TwoFactorService,
    private readonly providerAccounts: ProviderAccountService,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedSession> {
    assertHumanAuthAttempt(dto.website);

    const email = dto.email.toLowerCase();
    const chosen = dto.username
      ? sanitizeString(dto.username.trim()).substring(0, USERNAME_MAX_LENGTH)
      : '';

    if (await this.userRepository.exists({ where: { email } })) {
      throw apiError(ConflictException, 'AUTH_EMAIL_TAKEN');
    }
    if (chosen && (await usernameTaken(this.userRepository, chosen))) {
      throw apiError(ConflictException, 'AUTH_USERNAME_TAKEN');
    }
    // Without a chosen name, the part of the address before the `@`, numbered when it is taken
    const username = chosen || (await freeUsername(this.userRepository, email.split('@')[0]));
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.createAccount({
      username,
      email,
      passwordHash,
      authProvider: 'local',
      emailVerified: false,
    });
    return this.sessionService.createSession(user);
  }

  async login(dto: LoginDto): Promise<IssuedSession | TwoFactorChallengeResponseDto> {
    assertHumanAuthAttempt(dto.website);

    const identifier = sanitizeString(dto.identifier.trim());

    // Addresses and usernames are each unique ignoring case; should one account's username be
    // another's address, the address wins
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:identifier) OR LOWER(user.username) = LOWER(:identifier)', {
        identifier,
      })
      .orderBy('CASE WHEN LOWER(user.email) = LOWER(:identifier) THEN 0 ELSE 1 END')
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

  /**
   * The checks above are only hints: a racing registration can take the address or username
   * before the insert, which then answers `409` like the checks instead of a `500`.
   */
  private async createAccount(fields: Partial<User>): Promise<User> {
    try {
      return await this.dataSource.transaction((manager) => saveNewAccount(manager, fields));
    } catch (error) {
      const constraint = uniqueViolationOf(error);
      throw constraint === undefined ? error : takenConflict(constraint);
    }
  }
}

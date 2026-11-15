import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { Diary, SignUpRequest, User } from '@/database/entities';
import { CompleteSignUpDto, RegisterDto, SignUpStartedResponseDto } from '../dto';
import { assertHumanAuthAttempt } from './auth-bot-protection';
import { AuthService, defaultDiaryFor } from './auth.service';
import { AuthSessionService, type IssuedSession } from './auth-session.service';
import { EmailService, describeEmailFailure } from './email.service';

/** How long a sign-up link works. */
export const SIGN_UP_LINK_TTL_MS = 24 * 60 * 60 * 1000;
/** The least time between two sign-up emails to one address. */
export const SIGN_UP_EMAIL_INTERVAL_MS = 60 * 1000;
/** The most sign-up emails one address gets until its request expires. */
export const SIGN_UP_EMAILS_PER_ADDRESS = 5;
/** Tries at finding a free username from the address before asking the writer for one. */
const USERNAME_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

const SIGN_UP_STARTED: SignUpStartedResponseDto = {
  verificationRequired: true,
  message: 'Check your email to finish creating your account.',
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Verify-first sign-up. Wherever email can be sent, registration creates no account: it answers
 * every address the same way, after the same work, and emails it either a single-use link that
 * creates the account or, when the address already has one, a notice to sign in or reset the
 * password. The link asks for the chosen password again, so a link to an address someone else
 * signed up with cannot create an account whose password that person knows. The username is
 * checked only then, by someone who has proven the address.
 *
 * Without a mail server nothing can be proven: outside production, registration then signs the
 * writer in at once (`AuthService.register`, which still reports a taken email or username); in
 * production it answers `503 EMAIL_DELIVERY_NOT_CONFIGURED` for every address.
 */
@Injectable()
export class SignUpService {
  private readonly logger = new Logger(SignUpService.name);

  constructor(
    @InjectRepository(SignUpRequest)
    private readonly requestRepository: Repository<SignUpRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly sessionService: AuthSessionService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedSession | SignUpStartedResponseDto> {
    assertHumanAuthAttempt(dto.website);

    if (!this.emailService.isConfigured()) {
      if (isProduction()) {
        throw apiError(ServiceUnavailableException, 'EMAIL_DELIVERY_NOT_CONFIGURED');
      }
      return this.authService.register(dto);
    }

    await this.requestSignUp(dto);
    return { ...SIGN_UP_STARTED };
  }

  /** Creates the account from a sign-up link, once, and signs the writer in. */
  async complete(dto: CompleteSignUpDto): Promise<IssuedSession> {
    const tokenHash = hashToken(dto.token);
    const request = await this.requestRepository.findOne({
      where: { tokenHash, expiresAt: MoreThan(new Date()) },
    });
    if (!request?.passwordHash) {
      throw apiError(BadRequestException, 'AUTH_INVALID_SIGN_UP_TOKEN');
    }
    if (!(await bcrypt.compare(dto.password, request.passwordHash))) {
      throw apiError(UnauthorizedException, 'AUTH_INVALID_PASSWORD');
    }

    // Another sign-in (Google, Keycloak) may have created the account since the link was sent
    if (await this.userRepository.exists({ where: { email: request.email } })) {
      await this.requestRepository.delete({ id: request.id });
      throw apiError(ConflictException, 'AUTH_EMAIL_TAKEN');
    }

    const chosen = dto.username ?? request.username;
    if (chosen && (await this.userRepository.exists({ where: { username: chosen } }))) {
      throw apiError(ConflictException, 'AUTH_USERNAME_TAKEN');
    }
    const username = chosen ?? (await this.freeUsernameFor(request.email));

    const user = await this.createAccount(request, username);
    return this.sessionService.createSession(user, true);
  }

  /**
   * Records the sign-up and sends its email in the background. An address with an account gets a
   * row without a token, which only spaces out its notices. The password is hashed for every
   * address, so both kinds answer after the same work, and neither waits for the mail server.
   */
  private async requestSignUp(dto: RegisterDto): Promise<void> {
    const email = dto.email.toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const account = await this.userRepository.findOne({
      where: { email },
      select: { id: true, deletedAt: true },
    });
    const previous = await this.requestRepository.findOne({ where: { email } });
    const now = new Date();
    if (previous && !this.mayEmailAgain(previous, now)) {
      return;
    }

    const token = account ? null : crypto.randomBytes(32).toString('hex');
    await this.requestRepository.upsert(
      {
        email,
        tokenHash: token ? hashToken(token) : null,
        passwordHash: token ? passwordHash : null,
        username: token ? dto.username || null : null,
        sentCount: previous && previous.expiresAt > now ? previous.sentCount + 1 : 1,
        lastSentAt: now,
        expiresAt: new Date(now.getTime() + SIGN_UP_LINK_TTL_MS),
      },
      ['email'],
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    if (token) {
      this.sendInBackground('Sign-up link', () =>
        this.emailService.sendSignUpLinkEmail(email, `${frontendUrl}/complete-sign-up?token=${token}`),
      );
    } else if (!account?.deletedAt) {
      this.sendInBackground('Sign-up notice', () =>
        this.emailService.sendSignUpNoticeEmail(email, `${frontendUrl}/login`),
      );
    }
  }

  /** At most one email a minute per address, and five until its request expires. */
  private mayEmailAgain(previous: SignUpRequest, now: Date): boolean {
    if (previous.expiresAt <= now) return true;
    return (
      previous.sentCount < SIGN_UP_EMAILS_PER_ADDRESS &&
      now.getTime() - previous.lastSentAt.getTime() >= SIGN_UP_EMAIL_INTERVAL_MS
    );
  }

  /** Logs a failed send without the address or the link. */
  private sendInBackground(label: string, send: () => Promise<void>): void {
    void send().catch((error: unknown) => {
      this.logger.warn(`${label} email not sent: ${describeEmailFailure(error)}`);
    });
  }

  /** The part of the address before the `@`, or that with a number when it is taken. */
  private async freeUsernameFor(email: string): Promise<string> {
    const base = email.split('@')[0].substring(0, 50);
    for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt += 1) {
      const candidate =
        attempt === 0 ? base : `${base.substring(0, 43)}-${crypto.randomInt(100000, 1000000)}`;
      if (!(await this.userRepository.exists({ where: { username: candidate } }))) {
        return candidate;
      }
    }
    throw apiError(ConflictException, 'AUTH_USERNAME_TAKEN');
  }

  /**
   * Deletes the request and creates the verified account with its default diary in one
   * transaction. Claiming the request first keeps the link single-use when two requests race; a
   * username or address taken in the meantime rolls everything back and keeps the link working.
   */
  private async createAccount(request: SignUpRequest, username: string): Promise<User> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const claimed = await manager.delete(SignUpRequest, {
          id: request.id,
          tokenHash: request.tokenHash,
        });
        if (!claimed.affected) {
          throw apiError(BadRequestException, 'AUTH_INVALID_SIGN_UP_TOKEN');
        }
        const user = await manager.save(
          manager.create(User, {
            username,
            email: request.email,
            passwordHash: request.passwordHash,
            authProvider: 'local',
            emailVerified: true,
          }),
        );
        await manager.save(manager.create(Diary, defaultDiaryFor(user.id)));
        return user;
      });
    } catch (error) {
      const { code, constraint } = error as { code?: string; constraint?: string };
      if (code === UNIQUE_VIOLATION) {
        throw apiError(
          ConflictException,
          constraint?.includes('username') ? 'AUTH_USERNAME_TAKEN' : 'AUTH_EMAIL_TAKEN',
        );
      }
      throw error;
    }
  }
}

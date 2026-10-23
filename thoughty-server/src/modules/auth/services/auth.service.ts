import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { User, RefreshToken, Diary } from '@/database/entities';
import { getDefaultDiaryColor, sanitizeString } from '@/common/utils';
import { EmailService } from './email.service';
import {
  RegisterDto,
  LoginDto,
  OAuthDto,
  ChangePasswordDto,
  AuthResponseDto,
  TwoFactorChallengeResponseDto,
  TwoFactorCodeDto,
  SessionResponseDto,
  UserResponseDto,
} from '../dto';
import { assertHumanAuthAttempt } from './auth-bot-protection';
import { TwoFactorService } from './two-factor.service';
import { JwksKeyStore } from './jwks-key-store';
import { getSigningSecret } from '../auth-secrets';
import { REFRESH_TOKEN_TTL_MS } from '../refresh-token-cookie';

interface KeycloakTokenClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
}

interface GoogleIdTokenClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/** A newly issued session; the controller moves `refreshToken` into an httpOnly cookie. */
export interface IssuedSession extends AuthResponseDto {
  refreshToken: string;
}

export interface RotatedTokens {
  accessToken: string;
  refreshToken: string;
}

const GOOGLE_ISSUERS: [string, string] = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const DELETED_ACCOUNT_MESSAGE =
  'This account has been deleted. Please contact support if you believe this is a mistake.';
/**
 * A bcrypt hash (cost 12, like real password hashes) of a random throwaway password. It is
 * compared when an account has no usable password hash, so unknown, deleted, and password-less
 * accounts take as long to reject as a wrong password.
 */
const TIMING_EQUALIZER_HASH = '$2b$12$HlgReIVskPRRIFDGvS47oeqqKbNUqNQAzAUD8AR1l9NSG1SKXl7Mq';

/** Refresh tokens are looked up by the SHA-256 hex of the token; the token is never stored. */
export function hashRefreshToken(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshSecret: string;
  private readonly keycloakIssuer: string;
  private readonly keycloakAudience: string;
  private readonly keycloakKeys: JwksKeyStore;
  private readonly googleKeys = new JwksKeyStore('Google', GOOGLE_JWKS_URI);
  private readonly googleClientId: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly twoFactorService: TwoFactorService,
  ) {
    this.refreshSecret = getSigningSecret(this.configService, 'REFRESH_SECRET');
    this.keycloakIssuer = this.configService.get<string>(
      'KEYCLOAK_ISSUER',
      'https://keycloak.swirlit.dev/auth/realms/swirlit',
    );
    this.keycloakAudience = this.configService.get<string>('KEYCLOAK_AUDIENCE', 'oauth2-proxy');
    this.keycloakKeys = new JwksKeyStore(
      'Keycloak',
      this.configService.get<string>(
        'KEYCLOAK_JWKS_URI',
        `${this.keycloakIssuer}/protocol/openid-connect/certs`,
      ),
    );
    this.googleClientId = (this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '').trim();
  }

  private generateAccessToken(user: { id: number; email: string; username: string }): string {
    return this.jwtService.sign({ userId: user.id, email: user.email, username: user.username });
  }

  private generateRefreshToken(user: { id: number }): string {
    // The random id keeps two tokens issued in the same second for one user distinct.
    return this.jwtService.sign(
      { userId: user.id, jti: crypto.randomUUID() },
      { secret: this.refreshSecret, expiresIn: '7d' },
    );
  }

  private async createSession(user: User, isNewUser?: boolean): Promise<IssuedSession> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    await this.refreshTokenRepository.save({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
        ...(isNewUser === undefined ? {} : { isNewUser }),
      },
      accessToken,
      refreshToken,
    };
  }

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
      throw new ConflictException('Email already registered');
    }

    // Check if username exists
    const existingUsername = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already taken');
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

    // Create default diary
    await this.diaryRepository.save({
      userId: user.id,
      name: 'Thoughts',
      icon: '💭',
      color: getDefaultDiaryColor(0),
      isDefault: true,
      visibility: 'private',
    });

    return this.createSession(user);
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
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.twoFactorEnabled) {
      return this.twoFactorService.startChallenge(user, 'login');
    }

    return this.createSession(user);
  }

  async verifyTwoFactorLogin(dto: TwoFactorCodeDto): Promise<IssuedSession> {
    return this.createSession(await this.twoFactorService.consumeLogin(dto));
  }

  async oauthLogin(dto: OAuthDto): Promise<IssuedSession> {
    const identity = await this.verifyGoogleCredential(dto.credential);

    let user = await this.userRepository.findOne({
      where: { authProvider: 'google', providerId: identity.sub },
    });

    let isNewUser = false;

    if (user) {
      if (user.deletedAt) {
        throw new ForbiddenException(DELETED_ACCOUNT_MESSAGE);
      }
    } else {
      // Google verified this address, so an account registered with it is linked
      const existingUser = await this.userRepository.findOne({
        where: { email: identity.email },
      });

      if (existingUser) {
        if (existingUser.deletedAt) {
          throw new ForbiddenException(DELETED_ACCOUNT_MESSAGE);
        }

        existingUser.authProvider = 'google';
        existingUser.providerId = identity.sub;
        existingUser.avatarUrl = identity.picture || existingUser.avatarUrl;
        existingUser.emailVerified = true;
        user = await this.userRepository.save(existingUser);
      } else {
        // Create new user
        isNewUser = true;
        const emailName = identity.email.split('@')[0].substring(0, 50);
        const username = sanitizeString((identity.name || '').trim()).substring(0, 50);
        user = await this.userRepository.save({
          username: username || emailName,
          email: identity.email,
          authProvider: 'google',
          providerId: identity.sub,
          avatarUrl: identity.picture,
          emailVerified: true,
        });

        // Create default diary
        await this.diaryRepository.save({
          userId: user.id,
          name: 'Thoughts',
          icon: '💭',
          color: getDefaultDiaryColor(0),
          isDefault: true,
          visibility: 'private',
        });
      }
    }

    return this.createSession(user, isNewUser);
  }

  /**
   * Verifies a Google Identity Services credential (an ID token): its RS256 signature against
   * Google's published keys, issuer, audience (this server's Google client ID), and expiry. The
   * identity is taken only from the verified claims, and only a Google-verified email is accepted.
   */
  private async verifyGoogleCredential(
    credential: string,
  ): Promise<{ sub: string; email: string; name?: string; picture?: string }> {
    if (!this.googleClientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured on this server');
    }

    let claims: GoogleIdTokenClaims;
    try {
      claims = await this.verifyRs256Token<GoogleIdTokenClaims>(credential, this.googleKeys, {
        issuer: GOOGLE_ISSUERS,
        audience: this.googleClientId,
      });
    } catch (error) {
      this.logger.warn(
        `Rejected Google credential: ${error instanceof Error ? error.message : 'verification failed'}`,
      );
      throw new UnauthorizedException('Invalid Google credential');
    }

    const sub = typeof claims.sub === 'string' ? claims.sub : '';
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    if (!sub || !email || claims.email_verified !== true) {
      throw new UnauthorizedException('Google account email is missing or unverified');
    }

    return {
      sub,
      email,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      picture: typeof claims.picture === 'string' ? claims.picture : undefined,
    };
  }

  /** Verifies an RS256 JWT signed with a key from `keys`; throws on any failure. */
  private async verifyRs256Token<T extends object>(
    token: string,
    keys: JwksKeyStore,
    options: { issuer: string | [string, ...string[]]; audience: string },
  ): Promise<T> {
    const keyId = this.readKeyId(token);
    if (!keyId) {
      throw new Error('Token has no signing key id');
    }
    const publicKey = await keys.getPublicKeyPem(keyId);
    return this.jwtService.verifyAsync<T>(token, {
      // JwtService prefers its module-level HMAC secret over an invocation-level
      // `publicKey`. Supplying this verification key as `secret` explicitly
      // overrides that default while jsonwebtoken still validates it as an
      // asymmetric public key for RS256.
      secret: publicKey,
      algorithms: ['RS256'],
      issuer: options.issuer,
      audience: options.audience,
    });
  }

  private readKeyId(token: string): string | undefined {
    const decoded = this.jwtService.decode<{ header?: { kid?: unknown } } | null>(token, {
      complete: true,
    });
    const keyId = decoded?.header?.kid;
    return typeof keyId === 'string' && keyId ? keyId : undefined;
  }

  async keycloakLogin(accessToken?: string): Promise<IssuedSession> {
    if (!accessToken) {
      throw new UnauthorizedException('Keycloak access token is missing');
    }

    if (!this.readKeyId(accessToken)) {
      throw new UnauthorizedException('Keycloak access token has no signing key');
    }

    let claims: KeycloakTokenClaims;
    try {
      claims = await this.verifyRs256Token<KeycloakTokenClaims>(accessToken, this.keycloakKeys, {
        issuer: this.keycloakIssuer,
        audience: this.keycloakAudience,
      });
    } catch (error) {
      this.logger.warn(
        `Rejected Keycloak SSO token: ${error instanceof Error ? error.message : 'verification failed'}`,
      );
      throw new UnauthorizedException('Invalid Keycloak access token');
    }

    const subject = typeof claims.sub === 'string' ? claims.sub : '';
    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
    const preferredUsername =
      typeof claims.preferred_username === 'string' ? claims.preferred_username : '';
    if (!subject || !email || !preferredUsername || claims.email_verified !== true) {
      throw new UnauthorizedException('Keycloak identity is incomplete or unverified');
    }

    let user = await this.userRepository.findOne({
      where: { authProvider: 'keycloak', providerId: subject },
    });
    let isNewUser = false;

    user ??= await this.userRepository.findOne({ where: { email } });
    if (user?.deletedAt) {
      throw new ForbiddenException(DELETED_ACCOUNT_MESSAGE);
    }

    if (user) {
      user.authProvider = 'keycloak';
      user.providerId = subject;
      user.emailVerified = true;
      user = await this.userRepository.save(user);
    } else {
      isNewUser = true;
      user = await this.userRepository.save({
        username: preferredUsername.substring(0, 50),
        email,
        authProvider: 'keycloak',
        providerId: subject,
        emailVerified: true,
      });
      await this.diaryRepository.save({
        userId: user.id,
        name: 'Thoughts',
        icon: '💭',
        color: getDefaultDiaryColor(0),
        isDefault: true,
        visibility: 'private',
      });
    }

    return this.createSession(user, isNewUser);
  }

  /**
   * Rotates a refresh token. The presented token's row is deleted and returned in one statement,
   * so each token works once: a replayed or concurrently reused token finds no row. A new access
   * token and refresh token are issued in its place.
   */
  async refreshToken(refreshToken?: string): Promise<RotatedTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    try {
      this.jwtService.verify(refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const claimed = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('token_hash = :tokenHash', { tokenHash: hashRefreshToken(refreshToken) })
      .andWhere('expires_at > :now', { now: new Date() })
      .returning('user_id')
      .execute();
    const userId = (claimed.raw as Array<{ user_id?: number }> | undefined)?.[0]?.user_id;

    if (!userId) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    if (user.deletedAt) {
      throw new ForbiddenException('This account has been deleted.');
    }

    const { accessToken, refreshToken: rotatedRefreshToken } = await this.createSession(user);
    return { accessToken, refreshToken: rotatedRefreshToken };
  }

  async logout(refreshToken?: string): Promise<{ success: boolean }> {
    if (refreshToken) {
      await this.refreshTokenRepository.delete({ tokenHash: hashRefreshToken(refreshToken) });
    }
    return { success: true };
  }

  async listSessions(userId: number, currentRefreshToken?: string): Promise<SessionResponseDto[]> {
    const sessions = await this.refreshTokenRepository.find({
      where: { userId, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    const currentTokenHash = currentRefreshToken ? hashRefreshToken(currentRefreshToken) : null;

    return sessions.map((session) => ({
      id: session.id,
      current: session.tokenHash === currentTokenHash,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  async revokeSession(
    userId: number,
    sessionId: number,
    currentRefreshToken?: string,
  ): Promise<{ success: boolean }> {
    const session = await this.refreshTokenRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (currentRefreshToken && session.tokenHash === hashRefreshToken(currentRefreshToken)) {
      throw new BadRequestException('Use logout to end the current session');
    }

    await this.refreshTokenRepository.delete({ id: sessionId, userId });
    return { success: true };
  }

  async revokeOtherSessions(
    userId: number,
    currentRefreshToken?: string,
  ): Promise<{ success: boolean }> {
    if (!currentRefreshToken) {
      throw new BadRequestException('Current refresh token is required');
    }

    await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId })
      .andWhere('token_hash <> :currentTokenHash', {
        currentTokenHash: hashRefreshToken(currentRefreshToken),
      })
      .execute();

    return { success: true };
  }

  async getMe(userId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl || undefined,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      createdAt: user.createdAt,
    };
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Cannot change password for OAuth accounts without existing password',
      );
    }

    const validPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.refreshTokenRepository.delete({ userId });

    return { success: true, message: 'Password changed successfully' };
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    const successMessage = 'If an account exists with this email, a reset link will be sent.';

    if (user?.authProvider !== 'local' || user.deletedAt) {
      return { success: true, message: successMessage };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetToken = resetTokenHash;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.userRepository.save(user);

    // Send email
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Not awaited: waiting on the mail server would make existing accounts answer measurably
    // slower than unknown addresses.
    void this.emailService.sendPasswordResetEmail(user.email, resetUrl).catch((error: unknown) => {
      this.logger.warn('Password reset email not sent', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown email provider error',
        userId: user.id,
      });
    });

    return { success: true, message: successMessage };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository.findOne({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.refreshTokenRepository.delete({ userId: user.id });

    return { success: true, message: 'Password reset successfully' };
  }

  async deleteAccount(
    userId: number,
    password?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For local accounts, verify password
    if (user.authProvider === 'local') {
      if (!password) {
        throw new BadRequestException('Password is required to delete account');
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash || '');
      if (!validPassword) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    // Soft delete
    user.deletedAt = new Date();
    user.deletionReason = 'User requested deletion';
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.refreshTokenRepository.delete({ userId });

    // Send deletion email
    try {
      await this.emailService.sendAccountDeletionEmail(user.email);
    } catch (error) {
      this.logger.warn('Account deletion email not sent', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown email provider error',
        userId,
      });
    }

    return { success: true, message: 'Account has been deleted' };
  }
}

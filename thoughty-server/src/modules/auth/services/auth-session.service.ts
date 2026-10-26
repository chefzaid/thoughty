import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { RefreshToken, User } from '@/database/entities';
import { AuthResponseDto, SessionResponseDto } from '../dto';
import { getSigningSecret } from '../auth-secrets';
import { REFRESH_TOKEN_TTL_MS } from '../refresh-token-cookie';

/** A newly issued session; the controller moves `refreshToken` into an httpOnly cookie. */
export interface IssuedSession extends AuthResponseDto {
  refreshToken: string;
}

export interface RotatedTokens {
  accessToken: string;
  refreshToken: string;
}

/** Refresh tokens are looked up by the SHA-256 hex of the token; the token is never stored. */
export function hashRefreshToken(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

/**
 * Signed-in sessions: issuing the access and refresh tokens of a new session, rotating a refresh
 * token, signing out, and listing or revoking a user's other sessions.
 */
@Injectable()
export class AuthSessionService {
  private readonly refreshSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.refreshSecret = getSigningSecret(this.configService, 'REFRESH_SECRET');
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

  /** Starts a session for a signed-in user; `isNewUser` is reported only when it is given. */
  async createSession(user: User, isNewUser?: boolean): Promise<IssuedSession> {
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
}

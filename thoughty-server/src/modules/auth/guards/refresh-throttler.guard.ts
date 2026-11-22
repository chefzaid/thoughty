import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, ThrottlerException, type ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { RATE_LIMITS } from '@/common/rate-limit.constants';
import { AuthSessionService } from '../services/auth-session.service';
import { readRefreshTokenCookie } from '../refresh-token-cookie';

const THROTTLER_NAME = 'tokenRefresh';

/**
 * The refresh limit counted per account rather than per address: a refresh whose cookie carries a
 * token signed for an account counts against that account, so writers who share one address (an
 * office, a school, a mobile carrier's NAT) do not use up each other's refreshes. A refresh without
 * such a token (none, forged, expired) counts against its address, as every refresh did before. The
 * global throttler still caps all refreshes from one address (`RATE_LIMITS.tokenRefreshAddress`).
 *
 * A refused refresh answers `429 RATE_LIMITED` with `Retry-After` (seconds), as the global throttler does.
 */
@Injectable()
export class RefreshThrottlerGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
    private readonly sessions: AuthSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const account = this.sessions.refreshTokenAccount(readRefreshTokenCookie(request));
    const key = account === null ? `refresh:address:${request.ip}` : `refresh:account:${account}`;
    const { limit, ttl } = RATE_LIMITS.tokenRefresh;
    const { isBlocked, timeToBlockExpire } = await this.storage.increment(key, ttl, limit, ttl, THROTTLER_NAME);
    if (isBlocked) {
      http.getResponse<Response>().header('Retry-After', String(timeToBlockExpire));
      throw new ThrottlerException();
    }
    return true;
  }
}

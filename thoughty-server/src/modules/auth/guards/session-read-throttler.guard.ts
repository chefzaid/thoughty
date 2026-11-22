import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, type ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthenticatedUser } from '@/common/decorators';
import { RATE_LIMITS } from '@/common/rate-limit.constants';
import { countAgainst } from './throttle-key';

const THROTTLER_NAME = 'sessionRead';

/**
 * `GET /api/auth/me` counted per account rather than per address. The web reads it on every load and
 * whenever a session it could not confirm comes back, so writers who share one address (an office, a
 * school, a carrier's NAT) would otherwise use up each other's reads. It runs after the JWT guard, so the
 * request is always a signed-in account's; a request without one (never, behind that guard) counts against
 * its address. The global throttler still caps all reads from one address (`RATE_LIMITS.sessionReadAddress`).
 */
@Injectable()
export class SessionReadThrottlerGuard implements CanActivate {
  constructor(@InjectThrottlerStorage() private readonly storage: ThrottlerStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const account = request.user?.userId;
    const key = account === undefined ? `me:address:${request.ip}` : `me:account:${account}`;
    return countAgainst(this.storage, context, key, RATE_LIMITS.sessionRead, THROTTLER_NAME);
  }
}

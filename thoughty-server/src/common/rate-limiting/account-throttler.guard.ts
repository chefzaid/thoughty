import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../decorators';
import { ADDRESS_CEILING_FACTOR } from '../rate-limit.constants';
import { countAgainst } from './throttle-key';

/**
 * The account the global JWT guard verified for this request, or null when it is signed out. Only that
 * guard's `request.user` counts: it is set from a verified access token, never from what the client sends,
 * and a public route (which that guard lets through without reading any token) is always signed out here.
 */
function signedInAccount(request: { user?: Partial<AuthenticatedUser> }): number | null {
  const userId = request.user?.userId;
  return typeof userId === 'number' && Number.isSafeInteger(userId) ? userId : null;
}

/**
 * The global rate limit (`RATE_LIMITS`, each route's `@Throttle` included), counted per account for a
 * signed-in request and per address otherwise.
 *
 * - Signed out: the route's limit per address (`req.ip`, behind the proxies `TRUST_PROXY` trusts), as before.
 * - Signed in: the route's limit per account, so writers behind one address (an office, a school, a
 *   carrier's NAT) do not use up each other's; and every signed-in request from one address counts against
 *   `ADDRESS_CEILING_FACTOR` times the limit, so many accounts at one address cannot multiply it without end.
 *   A request its account's limit refuses is not counted against the address, so one writer over their own
 *   limit cannot lock out the others there.
 *
 * A refused request answers `429 RATE_LIMITED` with `Retry-After` (seconds); the `X-RateLimit-*` headers of
 * an accepted one describe the account's own budget. It must run after the global JWT guard.
 */
@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, getTracker, generateKey } = requestProps;
    const { req } = this.getRequestResponse(context);
    const account = signedInAccount(req);
    if (account === null) {
      return super.handleRequest(requestProps);
    }
    await super.handleRequest({ ...requestProps, getTracker: () => `account:${account}` });
    const name = throttler.name ?? 'default';
    const ceilingKey = generateKey(context, `accounts-at:${await getTracker(req, context)}`, name);
    return countAgainst(this.storageService, context, ceilingKey, { limit: limit * ADDRESS_CEILING_FACTOR, ttl }, name);
  }
}

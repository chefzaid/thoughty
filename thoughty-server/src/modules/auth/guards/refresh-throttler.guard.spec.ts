import { HttpStatus, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { RATE_LIMITS } from '@/common/rate-limit.constants';
import type { AuthSessionService } from '../services/auth-session.service';
import { RefreshThrottlerGuard } from './refresh-throttler.guard';

const REFRESH_SECRET = 'refresh-secret-for-the-guard-spec';
const jwt = new JwtService();
const refreshTokenFor = (userId: number, secret = REFRESH_SECRET) =>
  jwt.sign({ userId, jti: `${userId}-${Math.random()}` }, { secret, expiresIn: '7d' });

/** The real signature check, as `AuthSessionService.refreshTokenAccount` makes it. */
const sessions = {
  refreshTokenAccount: (token?: string) => {
    try {
      return token ? (jwt.verify<{ userId: number }>(token, { secret: REFRESH_SECRET }).userId) : null;
    } catch {
      return null;
    }
  },
} as unknown as AuthSessionService;

function refreshFrom(ip: string, token?: string) {
  const response = { header: jest.fn() };
  const request = { ip, headers: { cookie: token ? `thoughty_refresh_token=${token}` : undefined } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, response };
}

describe('RefreshThrottlerGuard', () => {
  const { limit } = RATE_LIMITS.tokenRefresh;
  let storage: ThrottlerStorageService;
  let guard: RefreshThrottlerGuard;

  beforeEach(() => {
    storage = new ThrottlerStorageService();
    guard = new RefreshThrottlerGuard(storage, sessions);
  });

  afterEach(() => storage.onApplicationShutdown());

  async function refreshUntilRefused(ip: string, token?: () => string): Promise<{ allowed: number; error: unknown; header: jest.Mock }> {
    for (let allowed = 0; allowed <= limit; allowed += 1) {
      const { context, response } = refreshFrom(ip, token?.());
      try {
        await guard.canActivate(context);
      } catch (error) {
        return { allowed, error, header: response.header };
      }
    }
    throw new Error('never refused');
  }

  it('lets writers who share an address refresh on their own counts', async () => {
    const ada = await refreshUntilRefused('203.0.113.7', () => refreshTokenFor(1));
    expect(ada.allowed).toBe(limit);

    // Another writer behind the same address is not refused for the first one's refreshes
    const { context } = refreshFrom('203.0.113.7', refreshTokenFor(2));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('counts one account across addresses and answers 429 with Retry-After', async () => {
    for (let index = 0; index < limit; index += 1) {
      await guard.canActivate(refreshFrom(`198.51.100.${index}`, refreshTokenFor(1)).context);
    }
    const { context, response } = refreshFrom('192.0.2.1', refreshTokenFor(1));

    const refused = guard.canActivate(context);
    await expect(refused).rejects.toBeInstanceOf(ThrottlerException);
    await refused.catch((error: ThrottlerException) => expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS));
    const [[name, seconds]] = response.header.mock.calls as [[string, string]];
    expect(name).toBe('Retry-After');
    expect(Number(seconds)).toBeGreaterThan(0);
    expect(Number(seconds)).toBeLessThanOrEqual(RATE_LIMITS.tokenRefresh.ttl / 1000);
  });

  it('counts a refresh without a signed token against its address, as before', async () => {
    const forged = await refreshUntilRefused('203.0.113.9', () => refreshTokenFor(1, 'not-the-refresh-secret'));
    expect(forged.allowed).toBe(limit);
    expect(forged.error).toBeInstanceOf(ThrottlerException);

    // The missing cookie of a signed-out visitor counts against the same address
    await expect(guard.canActivate(refreshFrom('203.0.113.9').context)).rejects.toBeInstanceOf(ThrottlerException);
    // A writer with a real token there still refreshes: the forged tokens counted against no account
    await expect(guard.canActivate(refreshFrom('203.0.113.9', refreshTokenFor(1)).context)).resolves.toBe(true);
  });
});

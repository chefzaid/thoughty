import { HttpStatus, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SkipThrottle, Throttle, ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { ADDRESS_CEILING_FACTOR } from '../rate-limit.constants';
import { AccountThrottlerGuard } from './account-throttler.guard';

const LIMIT = 4;
const CEILING = LIMIT * ADDRESS_CEILING_FACTOR;
const TTL = 60_000;

class NotesController {
  read() {}

  @Throttle({ default: { limit: 1, ttl: TTL } })
  write() {}

  @SkipThrottle()
  health() {}
}

type Handler = 'read' | 'write' | 'health';

/** A request to a route from an address, by the account the JWT guard verified (none: signed out). */
function requestFrom(ip: string, user?: unknown, handler: Handler = 'read', headers: Record<string, string> = {}) {
  const response = { header: jest.fn() };
  const request = { ip, user, headers };
  const context = {
    getClass: () => NotesController,
    getHandler: () => NotesController.prototype[handler],
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, response };
}

const writer = (userId: number) => ({ userId, email: `w${userId}@example.com`, username: `w${userId}` });

describe('AccountThrottlerGuard', () => {
  let storage: ThrottlerStorageService;
  let guard: AccountThrottlerGuard;

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new AccountThrottlerGuard({ throttlers: [{ name: 'default', limit: LIMIT, ttl: TTL }] }, storage, new Reflector());
    await guard.onModuleInit();
  });

  afterEach(() => storage.onApplicationShutdown());

  const send = (ip: string, user?: unknown, handler?: Handler) => guard.canActivate(requestFrom(ip, user, handler).context);

  async function sendMany(count: number, ip: string, user?: unknown, handler?: Handler) {
    for (let index = 0; index < count; index += 1) {
      await send(ip, user, handler);
    }
  }

  async function expectRefused(ip: string, user?: unknown, handler?: Handler) {
    const { context, response } = requestFrom(ip, user, handler);
    const refused = guard.canActivate(context);
    await expect(refused).rejects.toBeInstanceOf(ThrottlerException);
    await refused.catch((error: ThrottlerException) => expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS));
    const retryAfter = response.header.mock.calls.find(([name]) => name === 'Retry-After') as [string, number | string];
    expect(Number(retryAfter[1])).toBeGreaterThan(0);
    expect(Number(retryAfter[1])).toBeLessThanOrEqual(TTL / 1000);
  }

  it('counts a signed-out request against its address, as the plain throttler does', async () => {
    await sendMany(LIMIT, '203.0.113.7');
    await expectRefused('203.0.113.7');

    await expect(send('203.0.113.8')).resolves.toBe(true);
  });

  it('gives each signed-in account at one address its own budget', async () => {
    await sendMany(LIMIT, '203.0.113.7', writer(1));
    await expectRefused('203.0.113.7', writer(1));

    await expect(send('203.0.113.7', writer(2))).resolves.toBe(true);
    // Signed-out requests from the address keep their own count too
    await expect(send('203.0.113.7')).resolves.toBe(true);
  });

  it('counts one account across addresses', async () => {
    for (let index = 0; index < LIMIT; index += 1) {
      await send(`198.51.100.${index}`, writer(1));
    }
    await expectRefused('192.0.2.1', writer(1));
  });

  it('caps every account at one address at the ceiling, and only that address', async () => {
    for (let account = 1; account <= ADDRESS_CEILING_FACTOR; account += 1) {
      await sendMany(LIMIT, '203.0.113.7', writer(account));
    }
    // A writer with their whole budget left is refused there, and served from another address
    await expectRefused('203.0.113.7', writer(99));
    await expect(send('198.51.100.1', writer(99))).resolves.toBe(true);
  });

  it('does not count a request its account refused against the address', async () => {
    await sendMany(LIMIT, '203.0.113.7', writer(1));
    for (let refused = 0; refused < CEILING; refused += 1) {
      await expect(send('203.0.113.7', writer(1))).rejects.toBeInstanceOf(ThrottlerException);
    }

    await expect(send('203.0.113.7', writer(2))).resolves.toBe(true);
  });

  it('says the account\'s own budget in the rate-limit headers', async () => {
    const { context, response } = requestFrom('203.0.113.7', writer(1));
    await guard.canActivate(context);

    expect(response.header).toHaveBeenCalledWith('X-RateLimit-Limit', LIMIT);
    expect(response.header).toHaveBeenCalledWith('X-RateLimit-Remaining', LIMIT - 1);
  });

  it('keeps each route\'s own limit, per account and per route', async () => {
    await send('203.0.113.7', writer(1), 'write');
    await expectRefused('203.0.113.7', writer(1), 'write');

    await expect(send('203.0.113.7', writer(2), 'write')).resolves.toBe(true);
    await expect(send('203.0.113.7', writer(1), 'read')).resolves.toBe(true);
  });

  it('applies the route\'s ceiling, its own limit times the factor', async () => {
    for (let account = 1; account <= ADDRESS_CEILING_FACTOR; account += 1) {
      await send('203.0.113.7', writer(account), 'write');
    }
    await expectRefused('203.0.113.7', writer(99), 'write');
  });

  it('lets a route that skips throttling through', async () => {
    await sendMany(CEILING + 1, '203.0.113.7', writer(1), 'health');
    await expect(send('203.0.113.7', undefined, 'health')).resolves.toBe(true);
  });

  it.each([
    ['no user', undefined],
    ['a user without an id', { email: 'x@example.com' }],
    ['a non-numeric id', { userId: '1' }],
    ['a fractional id', { userId: 1.5 }],
  ])('counts a request with %s against its address', async (_case, user) => {
    await sendMany(LIMIT, '203.0.113.7', user);
    await expectRefused('203.0.113.7', user);
  });

  it('reads the account from the verified user only, never from what the client sends', async () => {
    const asClaimed = () => requestFrom('203.0.113.7', undefined, 'read', { 'x-user-id': '7', authorization: 'Bearer forged' });
    for (let index = 0; index < LIMIT; index += 1) {
      await guard.canActivate(asClaimed().context);
    }
    await expect(guard.canActivate(asClaimed().context)).rejects.toBeInstanceOf(ThrottlerException);
  });
});

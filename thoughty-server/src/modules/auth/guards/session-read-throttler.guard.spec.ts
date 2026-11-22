import { HttpStatus, type ExecutionContext } from '@nestjs/common';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { RATE_LIMITS } from '@/common/rate-limit.constants';
import { SessionReadThrottlerGuard } from './session-read-throttler.guard';

/** A read of `/me` from an address, by the account the JWT guard put on the request (none: no account). */
function readFrom(ip: string, userId?: number) {
  const response = { header: jest.fn() };
  const request = { ip, user: userId === undefined ? undefined : { userId, email: `${userId}@example.com`, username: `w${userId}` } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, response };
}

describe('SessionReadThrottlerGuard', () => {
  const { limit } = RATE_LIMITS.sessionRead;
  let storage: ThrottlerStorageService;
  let guard: SessionReadThrottlerGuard;

  beforeEach(() => {
    storage = new ThrottlerStorageService();
    guard = new SessionReadThrottlerGuard(storage);
  });

  afterEach(() => storage.onApplicationShutdown());

  async function readUntil(count: number, ip: (index: number) => string, userId?: number) {
    for (let index = 0; index < count; index += 1) {
      await guard.canActivate(readFrom(ip(index), userId).context);
    }
  }

  it('lets writers who share an address read on their own counts', async () => {
    await readUntil(limit, () => '203.0.113.7', 1);
    await expect(guard.canActivate(readFrom('203.0.113.7', 1).context)).rejects.toBeInstanceOf(ThrottlerException);

    await expect(guard.canActivate(readFrom('203.0.113.7', 2).context)).resolves.toBe(true);
  });

  it('counts one account across addresses and answers 429 with Retry-After', async () => {
    await readUntil(limit, (index) => `198.51.100.${index % 250}`, 1);
    const { context, response } = readFrom('192.0.2.1', 1);

    const refused = guard.canActivate(context);
    await expect(refused).rejects.toBeInstanceOf(ThrottlerException);
    await refused.catch((error: ThrottlerException) => expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS));
    const [[name, seconds]] = response.header.mock.calls as [[string, string]];
    expect(name).toBe('Retry-After');
    expect(Number(seconds)).toBeGreaterThan(0);
    expect(Number(seconds)).toBeLessThanOrEqual(RATE_LIMITS.sessionRead.ttl / 1000);
  });

  it('counts a request without an account against its address', async () => {
    await readUntil(limit, () => '203.0.113.9');
    await expect(guard.canActivate(readFrom('203.0.113.9').context)).rejects.toBeInstanceOf(ThrottlerException);
    await expect(guard.canActivate(readFrom('203.0.113.9', 1).context)).resolves.toBe(true);
  });
});

import { RedisThrottlerClient, RedisThrottlerStorage } from './redis-throttler.storage';

function createClient(overrides: Partial<RedisThrottlerClient> = {}): RedisThrottlerClient {
  return {
    isOpen: false,
    connect: jest.fn(async function connect(this: RedisThrottlerClient) {
      this.isOpen = true;
    }),
    eval: jest.fn(),
    quit: jest.fn(async function quit(this: RedisThrottlerClient) {
      this.isOpen = false;
    }),
    ...overrides,
  };
}

describe('RedisThrottlerStorage', () => {
  it('increments counters through Redis and returns throttler timing fields in seconds', async () => {
    const client = createClient({
      eval: jest.fn().mockResolvedValue([2, 1499, 0, 0]),
    });
    const storage = new RedisThrottlerStorage({ client, keyPrefix: 'test:throttle' });

    await expect(storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default')).resolves.toEqual({
      totalHits: 2,
      timeToExpire: 2,
      isBlocked: false,
      timeToBlockExpire: 0,
    });

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.eval).toHaveBeenCalledWith(expect.any(String), {
      keys: [expect.stringMatching(/^test:throttle:\{[a-f0-9]{64}\}:hits$/), expect.stringMatching(/^test:throttle:\{[a-f0-9]{64}\}:block$/)],
      arguments: ['15000', '5', '15000'],
    });
  });

  it('reports blocked requests from Redis', async () => {
    const client = createClient({
      isOpen: true,
      eval: jest.fn().mockResolvedValue([6, 9000, 1, 7000]),
    });
    const storage = new RedisThrottlerStorage({ client });

    await expect(storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default')).resolves.toEqual({
      totalHits: 6,
      timeToExpire: 9,
      isBlocked: true,
      timeToBlockExpire: 7,
    });

    expect(client.connect).not.toHaveBeenCalled();
  });

  it('falls back to in-process throttling if Redis fails', async () => {
    const client = createClient({
      connect: jest.fn().mockRejectedValue(new Error('redis down')),
    });
    const storage = new RedisThrottlerStorage({ client });

    const result = await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');

    expect(result.totalHits).toBe(1);
    expect(result.isBlocked).toBe(false);
    expect(result.timeToExpire).toBeGreaterThan(0);

    await storage.onApplicationShutdown();
  });

  it('quits the Redis client during shutdown when connected', async () => {
    const client = createClient({ isOpen: true });
    const storage = new RedisThrottlerStorage({ client });

    await storage.onApplicationShutdown();

    expect(client.quit).toHaveBeenCalledTimes(1);
  });
});

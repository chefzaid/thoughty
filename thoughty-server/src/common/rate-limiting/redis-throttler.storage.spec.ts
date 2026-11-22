import { Logger } from '@nestjs/common';
import { RedisThrottlerClient, RedisThrottlerStorage } from './redis-throttler.storage';

type FakeClient = RedisThrottlerClient & { emitError(error: unknown): void };

function createClient(overrides: Partial<RedisThrottlerClient> = {}): FakeClient {
  const errorListeners: Array<(error: unknown) => void> = [];
  return {
    isOpen: false,
    isReady: false,
    connect: jest.fn(async function connect(this: RedisThrottlerClient) {
      this.isOpen = true;
      this.isReady = true;
    }),
    eval: jest.fn(),
    destroy: jest.fn(function destroy(this: RedisThrottlerClient) {
      this.isOpen = false;
      this.isReady = false;
    }),
    on: jest.fn((event: 'error', listener: (error: unknown) => void) => {
      errorListeners.push(listener);
    }),
    emitError(error: unknown) {
      errorListeners.forEach((listener) => listener(error));
    },
    ...overrides,
  };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const storages: RedisThrottlerStorage[] = [];
/** The in-memory fallback keeps a timer per counter until shutdown. */
function track(storage: RedisThrottlerStorage): RedisThrottlerStorage {
  storages.push(storage);
  return storage;
}

describe('RedisThrottlerStorage', () => {
  let warn: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await Promise.all(storages.splice(0).map((storage) => storage.onApplicationShutdown()));
    jest.restoreAllMocks();
  });

  it('increments counters through a ready Redis and returns throttler timing fields in seconds', async () => {
    const client = createClient({
      isOpen: true,
      isReady: true,
      eval: jest.fn().mockResolvedValue([2, 1499, 0, 0]),
    });
    const storage = track(new RedisThrottlerStorage({ client, keyPrefix: 'test:throttle' }));

    await expect(storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default')).resolves.toEqual({
      totalHits: 2,
      timeToExpire: 2,
      isBlocked: false,
      timeToBlockExpire: 0,
    });

    expect(client.connect).not.toHaveBeenCalled();
    expect(client.eval).toHaveBeenCalledWith(expect.any(String), {
      keys: [expect.stringMatching(/^test:throttle:\{[a-f0-9]{64}\}:hits$/), expect.stringMatching(/^test:throttle:\{[a-f0-9]{64}\}:block$/)],
      arguments: ['15000', '5', '15000'],
    });
  });

  it('reports blocked requests from Redis', async () => {
    const client = createClient({
      isOpen: true,
      isReady: true,
      eval: jest.fn().mockResolvedValue([6, 9000, 1, 7000]),
    });
    const storage = track(new RedisThrottlerStorage({ client }));

    await expect(storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default')).resolves.toEqual({
      totalHits: 6,
      timeToExpire: 9,
      isBlocked: true,
      timeToBlockExpire: 7,
    });
  });

  it('listens for client errors, since node-redis stops reconnecting when an error event has no listener', () => {
    const client = createClient();

    track(new RedisThrottlerStorage({ client }));

    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('connects in the background at startup without waiting for Redis', () => {
    const client = createClient({ connect: jest.fn(() => new Promise<never>(() => undefined)) });
    const storage = track(new RedisThrottlerStorage({ client }));

    storage.onModuleInit();
    storage.onModuleInit();

    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('counts in memory while Redis has never connected, starting one connection for all requests', async () => {
    const client = createClient({ connect: jest.fn(() => new Promise<never>(() => undefined)) });
    const storage = track(new RedisThrottlerStorage({ client }));

    const results = await Promise.all([1, 2, 3].map(() => storage.increment('ip:127.0.0.1', 15_000, 2, 15_000, 'default')));
    await flushPromises();

    expect(results.map((result) => result.totalHits)).toEqual([1, 2, 3]);
    expect(results[2].isBlocked).toBe(true);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.eval).not.toHaveBeenCalled();
  });

  it('counts in memory while the client reconnects, without queueing a command or connecting again', async () => {
    const client = createClient({ isOpen: true, isReady: false });
    const storage = track(new RedisThrottlerStorage({ client }));

    const result = await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');

    expect(result.totalHits).toBe(1);
    expect(client.eval).not.toHaveBeenCalled();
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('falls back to in-process throttling if connecting fails, and tries again on a later request', async () => {
    const client = createClient({
      connect: jest.fn().mockRejectedValue(new Error('redis down')),
    });
    const storage = track(new RedisThrottlerStorage({ client }));

    const result = await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');
    await flushPromises();
    await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');
    await flushPromises();

    expect(result.totalHits).toBe(1);
    expect(result.isBlocked).toBe(false);
    expect(result.timeToExpire).toBeGreaterThan(0);
    expect(client.connect).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('redis down'));

    await storage.onApplicationShutdown();
  });

  it('falls back when a Redis command fails or times out, and warns once for the whole outage', async () => {
    const client = createClient({
      isOpen: true,
      isReady: true,
      eval: jest.fn().mockRejectedValue(new Error('Timeout')),
    });
    const storage = track(new RedisThrottlerStorage({ client }));

    const first = await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');
    const second = await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');
    client.emitError(new Error('Socket closed unexpectedly'));

    expect([first.totalHits, second.totalHits]).toEqual([1, 2]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("this pod's in-memory counters"));
  });

  it('warns once for repeated reconnect errors and names a non-Error cause', () => {
    const client = createClient({ isOpen: true });
    track(new RedisThrottlerStorage({ client }));

    client.emitError('ECONNREFUSED');
    client.emitError('ECONNREFUSED');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('(ECONNREFUSED)'));
  });

  it('goes back to Redis once the client is ready again and logs the recovery once', async () => {
    const client = createClient({ isOpen: true, isReady: false, eval: jest.fn().mockResolvedValue([1, 15_000, 0, 0]) });
    const storage = track(new RedisThrottlerStorage({ client }));
    client.emitError(new Error('connect ECONNREFUSED'));
    await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');

    client.isReady = true;
    await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');
    await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');

    expect(client.eval).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('shared between pods'));

    client.isReady = false;
    client.emitError(new Error('Socket closed unexpectedly'));
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not reconnect after shutdown', async () => {
    const client = createClient();
    const storage = track(new RedisThrottlerStorage({ client }));

    await storage.onApplicationShutdown();
    storage.onModuleInit();
    const result = await storage.increment('ip:127.0.0.1', 15_000, 5, 15_000, 'default');

    expect(result.totalHits).toBe(1);
    expect(client.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['connected', true],
    ['reconnecting, since a QUIT would wait for Redis', false],
  ])('closes the Redis connection during shutdown while %s', async (_state, isReady) => {
    const client = createClient({ isOpen: true, isReady });
    const storage = track(new RedisThrottlerStorage({ client }));

    await storage.onApplicationShutdown();

    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  it('leaves a Redis client that never connected alone during shutdown', async () => {
    const client = createClient();
    const storage = track(new RedisThrottlerStorage({ client }));

    await storage.onApplicationShutdown();

    expect(client.destroy).not.toHaveBeenCalled();
  });
});

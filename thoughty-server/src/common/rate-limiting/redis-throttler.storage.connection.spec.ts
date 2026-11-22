import { Logger } from '@nestjs/common';
import { AddressInfo, createServer, Server, Socket } from 'node:net';
import { createRedisThrottlerClientFromEnv, RedisThrottlerClient, RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * The real node-redis client against a port nobody listens on, then against a minimal RESP server
 * on that port: rate-limited requests must never wait for Redis.
 */

type EventedClient = RedisThrottlerClient & { once(event: 'error' | 'ready', listener: () => void): unknown };

const LIMIT_ARGS = [60_000, 5, 60_000, 'default'] as const;
/** EVAL's answer from the RESP server: 42 hits, so a Redis count is told apart from an in-memory one. */
const REDIS_HITS = 42;

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function within<T>(milliseconds: number, promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`still pending after ${milliseconds} ms`)), milliseconds);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

function nextEvent(client: EventedClient, event: 'error' | 'ready'): Promise<void> {
  return new Promise((resolve) => client.once(event, resolve));
}

/** Reads RESP arrays of bulk strings (what clients send) and answers each command. */
function startRespServer(port: number, options: { answerEval: boolean }): Promise<{ server: Server; sockets: Set<Socket> }> {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1');
      for (let command = readCommand(); command; command = readCommand()) {
        if (command[0].toUpperCase() !== 'EVAL') {
          socket.write('+OK\r\n');
        } else if (options.answerEval) {
          socket.write(`*4\r\n:${REDIS_HITS}\r\n:60000\r\n:0\r\n:0\r\n`);
        }
      }
    });

    function readCommand(): string[] | null {
      const lines = buffer.split('\r\n');
      const count = Number(lines[0]?.slice(1));
      if (!lines[0]?.startsWith('*') || lines.length < count * 2 + 2) {
        return null;
      }
      const args = Array.from({ length: count }, (_, index) => lines[index * 2 + 2]);
      buffer = lines.slice(count * 2 + 1).join('\r\n');
      return args;
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, sockets })));
}

async function stopRespServer({ server, sockets }: { server: Server; sockets: Set<Socket> }): Promise<void> {
  const closed = new Promise<void>((resolve) => server.close(() => resolve()));
  sockets.forEach((socket) => socket.destroy());
  await closed;
}

describe('RedisThrottlerStorage with the real Redis client', () => {
  let port: number;
  let client: EventedClient;
  let storage: RedisThrottlerStorage;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    port = await freePort();
    client = createRedisThrottlerClientFromEnv({ REDIS_HOST: '127.0.0.1', REDIS_PORT: String(port) }) as EventedClient;
    storage = new RedisThrottlerStorage({ client });
  });

  afterEach(async () => {
    await storage.onApplicationShutdown();
    jest.restoreAllMocks();
  });

  it('answers from memory at once after the first failed connect instead of queueing behind the reconnect', async () => {
    const failedConnect = nextEvent(client, 'error');
    storage.onModuleInit();
    await failedConnect;

    const results = await within(
      1000,
      Promise.all(Array.from({ length: 6 }, () => storage.increment('ip:203.0.113.7', ...LIMIT_ARGS))),
    );

    expect(client.isOpen).toBe(true);
    expect(client.isReady).toBe(false);
    expect(results.map((result) => result.totalHits)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(results[5].isBlocked).toBe(true);
  });

  it('uses Redis once it comes up, falls back at once when it drops, and resumes when it is back', async () => {
    const failedConnect = nextEvent(client, 'error');
    storage.onModuleInit();
    await failedConnect;
    expect((await within(1000, storage.increment('ip:203.0.113.7', ...LIMIT_ARGS))).totalHits).toBe(1);

    let ready = nextEvent(client, 'ready');
    let redis = await startRespServer(port, { answerEval: true });
    await ready;
    expect((await within(1000, storage.increment('ip:203.0.113.7', ...LIMIT_ARGS))).totalHits).toBe(REDIS_HITS);

    const dropped = nextEvent(client, 'error');
    await stopRespServer(redis);
    await dropped;
    expect((await within(1000, storage.increment('ip:203.0.113.7', ...LIMIT_ARGS))).totalHits).toBe(2);

    ready = nextEvent(client, 'ready');
    redis = await startRespServer(port, { answerEval: true });
    await ready;
    expect((await within(1000, storage.increment('ip:203.0.113.7', ...LIMIT_ARGS))).totalHits).toBe(REDIS_HITS);

    await storage.onApplicationShutdown();
    await stopRespServer(redis);
  });

  it('falls back when a connected Redis stops answering', async () => {
    const redis = await startRespServer(port, { answerEval: false });
    const ready = nextEvent(client, 'ready');
    storage.onModuleInit();
    await ready;

    const result = await within(2000, storage.increment('ip:203.0.113.7', ...LIMIT_ARGS));

    expect(result.totalHits).toBe(1);
    await storage.onApplicationShutdown();
    await stopRespServer(redis);
  });
});

import { Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';

type RedisCommandResult = Array<number | string>;
type StorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

export interface RedisThrottlerClient {
  isOpen: boolean;
  isReady: boolean;
  connect(): Promise<unknown>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<RedisCommandResult>;
  destroy(): void;
  on(event: 'error', listener: (error: unknown) => void): unknown;
}

export interface RedisThrottlerStorageOptions {
  client: RedisThrottlerClient;
  keyPrefix?: string;
}

const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local totalHits = tonumber(redis.call('GET', hitsKey) or limit + 1)
  local hitTtl = redis.call('PTTL', hitsKey)
  return { totalHits, hitTtl, 1, blockTtl }
end

local totalHits = redis.call('INCR', hitsKey)
if totalHits == 1 or redis.call('PTTL', hitsKey) < 0 then
  redis.call('PEXPIRE', hitsKey, ttl)
end

local hitTtl = redis.call('PTTL', hitsKey)
if totalHits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  redis.call('PEXPIRE', hitsKey, blockDuration)
  hitTtl = blockDuration
  return { totalHits, hitTtl, 1, blockDuration }
end

return { totalHits, hitTtl, 0, 0 }
`;

/**
 * A rate-limit command that Redis has not answered within this delay falls back to the in-memory counters:
 * node-redis's own command timeout stops counting once a command is written, so it cannot see a stalled server.
 */
export const REDIS_THROTTLER_COMMAND_TIMEOUT_MS = 500;
/** Commands waiting on a stalled connection beyond this are rejected at once instead of piling up. */
export const REDIS_THROTTLER_MAX_PENDING_COMMANDS = 1000;

function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis did not answer within ${milliseconds} ms`)), milliseconds);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Shares rate-limit counters between API pods through Redis. While Redis is unreachable (not
 * connected yet, reconnecting after a drop, or too slow to answer) each request is counted by
 * this pod's in-memory storage instead, so limits are per pod until the client is ready again.
 */
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();
  private readonly keyPrefix: string;
  private connectPromise: Promise<unknown> | null = null;
  private unavailable = false;
  private shutDown = false;

  constructor(private readonly options: RedisThrottlerStorageOptions) {
    this.keyPrefix = options.keyPrefix ?? 'thoughty:throttle';
    // node-redis emits an error for every failed (re)connect; without a listener it throws and stops reconnecting
    options.client.on('error', (error) => this.markUnavailable(error));
  }

  onModuleInit(): void {
    this.startConnecting();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    const { client } = this.options;
    if (!client.isReady) {
      this.startConnecting();
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }

    try {
      const digest = createHash('sha256').update(`${throttlerName}:${key}`).digest('hex');
      const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = await withDeadline(
        client.eval(INCREMENT_SCRIPT, {
          keys: [`${this.keyPrefix}:{${digest}}:hits`, `${this.keyPrefix}:{${digest}}:block`],
          arguments: [String(ttl), String(limit), String(blockDuration)],
        }),
        REDIS_THROTTLER_COMMAND_TIMEOUT_MS,
      );
      this.markAvailable();

      return {
        totalHits: Number(totalHits),
        timeToExpire: this.msToSeconds(Number(timeToExpireMs)),
        isBlocked: Number(isBlocked) === 1,
        timeToBlockExpire: this.msToSeconds(Number(timeToBlockExpireMs)),
      };
    } catch (error) {
      this.markUnavailable(error);
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.shutDown = true;
    this.fallback.onApplicationShutdown();

    // Closing the socket is all Redis needs (it deprecates QUIT), and unlike a QUIT it never waits for a
    // Redis that is reconnecting or stalled. Rate-limit commands still in flight fall back to memory.
    if (this.options.client.isOpen) {
      this.options.client.destroy();
    }
  }

  /** Connects in the background: the client then reconnects by itself until it is destroyed. */
  private startConnecting(): void {
    if (this.shutDown || this.connectPromise || this.options.client.isOpen) {
      return;
    }

    this.connectPromise = Promise.resolve(this.options.client.connect())
      .catch((error: unknown) => this.markUnavailable(error))
      .finally(() => {
        this.connectPromise = null;
      });
  }

  private markUnavailable(error: unknown): void {
    if (this.unavailable) {
      return;
    }
    this.unavailable = true;
    const reason = error instanceof Error ? error.message || error.name : String(error);
    this.logger.warn(
      `Redis is unreachable (${reason}): rate limits fall back to this pod's in-memory counters until it answers again`,
    );
  }

  private markAvailable(): void {
    if (!this.unavailable) {
      return;
    }
    this.unavailable = false;
    this.logger.log('Redis answers again: rate limits are shared between pods');
  }

  private msToSeconds(milliseconds: number): number {
    return Math.max(0, Math.ceil(milliseconds / 1000));
  }
}

export function createRedisThrottlerClientFromEnv(env: NodeJS.ProcessEnv = process.env): RedisThrottlerClient | null {
  const url = env.REDIS_URL?.trim();
  const host = env.REDIS_HOST?.trim();

  if (!url && !host) {
    return null;
  }

  const socket = url
    ? undefined
    : {
        host,
        port: Number.parseInt(env.REDIS_PORT || '6379', 10),
        ...(env.REDIS_TLS === 'true' ? { tls: true as const } : {}),
      };

  return createClient({
    url: url || undefined,
    password: url ? undefined : env.REDIS_PASSWORD || undefined,
    database: Number.parseInt(env.REDIS_DB || '0', 10),
    socket,
    // Reject commands while reconnecting instead of queueing them until Redis is back
    disableOfflineQueue: true,
    commandsQueueMaxLength: REDIS_THROTTLER_MAX_PENDING_COMMANDS,
  }) as unknown as RedisThrottlerClient;
}

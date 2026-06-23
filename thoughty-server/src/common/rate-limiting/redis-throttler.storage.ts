import { OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { createHash } from 'crypto';
import { createClient } from 'redis';

type RedisCommandResult = Array<number | string>;
type StorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

export interface RedisThrottlerClient {
  isOpen: boolean;
  connect(): Promise<unknown>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<RedisCommandResult>;
  quit(): Promise<unknown>;
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

export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly fallback = new ThrottlerStorageService();
  private readonly keyPrefix: string;
  private connectPromise: Promise<unknown> | null = null;

  constructor(private readonly options: RedisThrottlerStorageOptions) {
    this.keyPrefix = options.keyPrefix ?? 'thoughty:throttle';
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    try {
      await this.ensureConnected();
      const digest = createHash('sha256').update(`${throttlerName}:${key}`).digest('hex');
      const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = await this.options.client.eval(
        INCREMENT_SCRIPT,
        {
          keys: [`${this.keyPrefix}:{${digest}}:hits`, `${this.keyPrefix}:{${digest}}:block`],
          arguments: [String(ttl), String(limit), String(blockDuration)],
        },
      );

      return {
        totalHits: Number(totalHits),
        timeToExpire: this.msToSeconds(Number(timeToExpireMs)),
        isBlocked: Number(isBlocked) === 1,
        timeToBlockExpire: this.msToSeconds(Number(timeToBlockExpireMs)),
      };
    } catch {
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.fallback.onApplicationShutdown();

    if (this.options.client.isOpen) {
      await this.options.client.quit();
    }
  }

  private ensureConnected(): Promise<unknown> {
    if (this.options.client.isOpen) {
      return Promise.resolve();
    }

    this.connectPromise ??= this.options.client.connect().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
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
  }) as unknown as RedisThrottlerClient;
}

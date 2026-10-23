import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import express from 'express';
import request from 'supertest';
import { RedisThrottlerClient, RedisThrottlerStorage } from '../rate-limiting/redis-throttler.storage';
import { getTrustProxySetting, TrustProxySetting, useTrustProxy } from './trust-proxy';

function ipApp(setting: TrustProxySetting) {
  const app = express();
  app.set('trust proxy', setting);
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

async function clientIp(setting: TrustProxySetting, forwardedFor?: string): Promise<string> {
  const req = request(ipApp(setting)).get('/ip');
  if (forwardedFor) {
    req.set('X-Forwarded-For', forwardedFor);
  }
  const response = await req.expect(200);
  return response.body.ip;
}

describe('getTrustProxySetting', () => {
  it('trusts no proxy outside production by default', () => {
    expect(getTrustProxySetting({})).toBe(false);
    expect(getTrustProxySetting({ NODE_ENV: 'development' })).toBe(false);
  });

  it('trusts loopback and private-network proxies in production by default', () => {
    expect(getTrustProxySetting({ NODE_ENV: 'production' })).toEqual(['loopback', 'linklocal', 'uniquelocal']);
    expect(getTrustProxySetting({ NODE_ENV: 'production', TRUST_PROXY: '  ' })).toEqual([
      'loopback',
      'linklocal',
      'uniquelocal',
    ]);
  });

  it('parses booleans, hop counts and address lists like Express', () => {
    expect(getTrustProxySetting({ NODE_ENV: 'production', TRUST_PROXY: 'false' })).toBe(false);
    expect(getTrustProxySetting({ TRUST_PROXY: 'TRUE' })).toBe(true);
    expect(getTrustProxySetting({ TRUST_PROXY: '2' })).toBe(2);
    expect(getTrustProxySetting({ TRUST_PROXY: 'loopback, 10.0.0.0/8 ,,fc00::/7' })).toEqual([
      'loopback',
      '10.0.0.0/8',
      'fc00::/7',
    ]);
  });

  it('fails at startup on an invalid address', () => {
    expect(() => useTrustProxy(express(), { TRUST_PROXY: 'loopback, not-an-ip' })).toThrow();
  });
});

describe('trust proxy client address', () => {
  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    await expect(clientIp(false, '203.0.113.7')).resolves.toMatch(/127\.0\.0\.1$|^::1$/);
  });

  it('resolves the client behind a private-network proxy without trusting public hops', async () => {
    const setting = getTrustProxySetting({ NODE_ENV: 'production' });

    await expect(clientIp(setting, '203.0.113.7')).resolves.toBe('203.0.113.7');
    // A client-supplied entry left of a public address is not trusted.
    await expect(clientIp(setting, '198.51.100.1, 203.0.113.7')).resolves.toBe('203.0.113.7');
  });

  it('resolves the client behind an edge proxy and the ingress with a hop count', async () => {
    // Client-supplied value, real client, edge proxy; the ingress is the socket peer.
    await expect(clientIp(2, '198.51.100.1, 203.0.113.7, 172.70.1.1')).resolves.toBe('203.0.113.7');
  });
});

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

/** Counts hits per Redis key; enough of the storage script for the throttler to block. */
function createCountingRedisClient(): RedisThrottlerClient & { keys: Set<string> } {
  const hits = new Map<string, number>();
  const keys = new Set<string>();
  return {
    isOpen: true,
    keys,
    connect: jest.fn(),
    quit: jest.fn(),
    eval: jest.fn(async (_script: string, options: { keys: string[]; arguments: string[] }) => {
      const [hitsKey] = options.keys;
      const [ttl, limit] = options.arguments.map(Number);
      const total = (hits.get(hitsKey) ?? 0) + 1;
      hits.set(hitsKey, total);
      keys.add(hitsKey);
      return total > limit ? [total, ttl, 1, ttl] : [total, ttl, 0, 0];
    }),
  };
}

describe('throttling behind a proxy', () => {
  let app: INestApplication;
  let client: ReturnType<typeof createCountingRedisClient>;

  beforeEach(async () => {
    client = createCountingRedisClient();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          storage: new RedisThrottlerStorage({ client }),
          throttlers: [{ name: 'default', limit: 1, ttl: 60_000 }],
        }),
      ],
      controllers: [PingController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    useTrustProxy(app as NestExpressApplication, { NODE_ENV: 'production' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps a separate Redis counter for each client behind the same proxy', async () => {
    const server = app.getHttpServer();

    await request(server).get('/ping').set('X-Forwarded-For', '203.0.113.7').expect(200);
    await request(server).get('/ping').set('X-Forwarded-For', '203.0.113.7').expect(429);
    await request(server).get('/ping').set('X-Forwarded-For', '203.0.113.8').expect(200);

    expect(client.keys.size).toBe(2);
  });
});

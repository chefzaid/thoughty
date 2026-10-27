import { Controller, Get, type LoggerService, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FeatureTelemetryService, HttpMetricsService } from '../metrics';
import { JsonLogger } from './json-logger.service';
import { applyRequestLogging, RequestLoggingMiddleware } from './request-logging.middleware';

@Controller('items')
class ItemsController {
  @Get()
  list(): string[] {
    return ['one'];
  }
}

/** Nest's own messages while the app boots and serves, by level. */
class CapturingLogger implements LoggerService {
  readonly lines: string[] = [];
  log(): void {}
  warn(message: unknown): void {
    this.lines.push(`warn ${String(message)}`);
  }
  error(message: unknown): void {
    this.lines.push(`error ${String(message)}`);
  }
}

/** Boots a one-controller app under the `/api` prefix, as `configureApp` sets it, with the given registration. */
async function bootWith(register: (consumer: MiddlewareConsumer) => void) {
  @Module({
    controllers: [ItemsController],
    providers: [
      { provide: JsonLogger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
      { provide: HttpMetricsService, useValue: { record: jest.fn() } },
      { provide: FeatureTelemetryService, useValue: { record: jest.fn() } },
    ],
  })
  class LoggedModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
      register(consumer);
    }
  }

  const logger = new CapturingLogger();
  const moduleRef = await Test.createTestingModule({ imports: [LoggedModule] }).compile();
  const app = moduleRef.createNestApplication({ logger });
  app.setGlobalPrefix('api');
  await app.init();
  return { app, logger };
}

describe('applyRequestLogging', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('boots without a route warning and logs every request under /api, unknown routes included', async () => {
    const booted = await bootWith(applyRequestLogging);
    app = booted.app;

    expect(booted.logger.lines).toEqual([]);
    for (const path of ['/api', '/api/', '/api/items', '/api/missing/deep?x=1']) {
      const response = await request(app.getHttpServer()).get(path);
      expect(response.headers['x-request-id']).toEqual(expect.any(String));
    }
    for (const path of ['/', '/items', '/apix']) {
      const response = await request(app.getHttpServer()).get(path);
      expect(response.headers['x-request-id']).toBeUndefined();
    }
    expect(booted.logger.lines).toEqual([]);
  });

  it('is the check that catches the bare wildcard Nest 11 warns about', async () => {
    const booted = await bootWith((consumer) => consumer.apply(RequestLoggingMiddleware).forRoutes('*'));
    app = booted.app;

    expect(booted.logger.lines).toEqual([expect.stringContaining('warn Unsupported route path: "/api/*"')]);
  });
});

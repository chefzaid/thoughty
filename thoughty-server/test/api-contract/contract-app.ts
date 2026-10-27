import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import type { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { JsonLogger } from '../../src/common';
import { createPostgresTestDatabase } from '../../src/database/postgres-test-database.test-helpers';
import { FakeObjectStorage } from './fake-object-storage';

export const CONTRACT_BUCKET = 'thoughty-contract';

/**
 * Settings that would reach a real outside service. They are set to empty strings, which the API
 * reads as unset and which a developer's `.env` cannot override: the contract specs never call
 * OpenRouter, an SMTP server, Google, Keycloak, a cloud drive, a flag provider or Redis.
 */
const EXTERNAL_SERVICE_SETTINGS = [
  'OPENROUTER_API_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'GOOGLE_CLIENT_ID',
  'KEYCLOAK_AUDIENCE',
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'DROPBOX_CLIENT_ID',
  'DROPBOX_CLIENT_SECRET',
  'ONEDRIVE_CLIENT_ID',
  'ONEDRIVE_CLIENT_SECRET',
  'FEATURE_FLAG_PROVIDER_URL',
  'FEATURE_FLAG_PROVIDER_TOKEN',
  'REDIS_URL',
  'REDIS_HOST',
  'POSTGRES_READ_REPLICA_HOSTS',
  'TRUST_PROXY',
] as const;

/** A JSON logger that keeps its lines, so a failed request can show what the API logged for it. */
export class CapturedJsonLogger extends JsonLogger {
  readonly lines: string[] = [];

  override error(message: unknown, ...optionalParams: unknown[]): void {
    this.lines.push(`error ${String(message)} ${safeStringify(optionalParams)}`);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    this.lines.push(`warn ${String(message)} ${safeStringify(optionalParams)}`);
  }

  override log(): void {}

  override debug(): void {}

  override verbose(): void {}
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export interface ContractApi {
  app: NestExpressApplication;
  http: Server;
  /** A second connection to the suite's database, for setup the API offers no route for. */
  dataSource: DataSource;
  storage: FakeObjectStorage;
  logger: CapturedJsonLogger;
  /** Every outside URL the API tried to `fetch`, which failed as if the network were down. */
  blockedRequests: string[];
  close: () => Promise<void>;
}

/**
 * Makes `fetch` (OpenRouter, Google, cloud drives, the flag provider) fail as an unreachable
 * network does, so no spec ever calls the internet, and records what was tried. Returns the undo.
 */
function blockOutboundFetch(blockedRequests: string[]): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    blockedRequests.push(url);
    return Promise.reject(
      new TypeError(`fetch failed: outbound request to ${url} blocked by the contract specs`),
    );
  };
  return () => {
    globalThis.fetch = original;
  };
}

function pointAtDatabase(url: string): void {
  const { hostname, port, username, password, pathname } = new URL(url);
  process.env.POSTGRES_HOST = hostname;
  process.env.POSTGRES_PORT = port || '5432';
  process.env.POSTGRES_USER = decodeURIComponent(username) || 'postgres';
  process.env.POSTGRES_PASSWORD = decodeURIComponent(password);
  process.env.POSTGRES_DB = pathname.slice(1);
}

/**
 * Boots the whole API as `main.ts` does (`AppModule` with `configureApp`: body parsers, helmet,
 * CORS, the `/api` prefix, the global validation pipe, guards, filters and middleware) against a
 * migrated database of its own and a local object storage, with no outside service reachable.
 * Only the log sink differs: the request log and Nest's own logs are kept in memory instead of
 * written to stdout.
 */
export async function startContractApi(): Promise<ContractApi> {
  const database = await createPostgresTestDatabase();
  const storage = new FakeObjectStorage();
  const blockedRequests: string[] = [];
  const restoreFetch = blockOutboundFetch(blockedRequests);
  try {
    pointAtDatabase(database.url);
    for (const name of EXTERNAL_SERVICE_SETTINGS) process.env[name] = '';
    process.env.S3_ENDPOINT = await storage.start();
    process.env.S3_BUCKET = CONTRACT_BUCKET;
    process.env.S3_ACCESS_KEY = 'contract';
    process.env.S3_SECRET_KEY = 'contract-secret';

    const logger = new CapturedJsonLogger();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JsonLogger)
      .useValue(logger)
      .compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger,
    });
    configureApp(app);
    await app.init();
    // The S3 client loads its HTTP handler with a dynamic import(), which Jest only runs with this flag
    if (!storage.hasBucket(CONTRACT_BUCKET)) {
      await app.close();
      throw new Error(
        'The API could not reach object storage: run the contract specs with node --experimental-vm-modules (npm run test:e2e)',
      );
    }

    return {
      app,
      http: app.getHttpServer() as Server,
      dataSource: database.dataSource,
      storage,
      logger,
      blockedRequests,
      close: async () => {
        await app.close();
        restoreFetch();
        await storage.stop();
        await database.drop();
      },
    };
  } catch (error) {
    restoreFetch();
    await storage.stop();
    await database.drop();
    throw error;
  }
}

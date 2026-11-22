import type { Server } from 'node:http';
import { type INestApplication, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountEvent, Setting } from '@/database/entities';
import { AccountActivityService } from './modules/auth/account-activity/account-activity.service';
import { EmailService } from './modules/auth/services/email.service';
import { enableGracefulShutdown, SHUTDOWN_SIGNALS } from './graceful-shutdown';

/** Stands in for the database pool, which TypeORM closes in `onApplicationShutdown`. */
@Injectable()
class DatabasePool implements OnApplicationShutdown {
  readonly steps: string[] = [];

  onApplicationShutdown(signal?: string): void {
    this.steps.push(`pool closed on ${signal}`);
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('enableGracefulShutdown', () => {
  let app: INestApplication;
  let pool: DatabasePool;
  let activity: AccountActivityService;
  let sending: ReturnType<typeof deferred>;

  beforeEach(async () => {
    sending = deferred();
    const events = {
      create: jest.fn((row: object) => row),
      save: jest.fn(async (row: object) => ({ id: 1, createdAt: new Date('2026-11-22T09:00:00Z'), ...row })),
      // An unknown browser, on an account that has signed in before: the sign-in sends an email
      exists: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    };
    const manager = { query: jest.fn().mockResolvedValue([]), getRepository: () => events };
    Object.assign(events, { manager: { transaction: (work: (m: typeof manager) => unknown) => work(manager) } });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountActivityService,
        DatabasePool,
        { provide: getRepositoryToken(AccountEvent), useValue: events },
        { provide: getRepositoryToken(Setting), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: ConfigService, useValue: { get: (_key: string, fallback: string) => fallback } },
        {
          provide: EmailService,
          useValue: {
            isConfigured: () => true,
            sendRenderedEmail: jest.fn(async () => {
              await sending.promise;
              pool.steps.push('email sent');
            }),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    pool = app.get(DatabasePool);
    activity = app.get(AccountActivityService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    sending.resolve();
    // Unless the signal already closed it
    if (pool.steps.length === 0) await app.close();
  });

  it('on SIGTERM, sends the emails in flight, then closes the server and the database, and exits', async () => {
    const listenersBefore = process.listenerCount('SIGTERM');
    enableGracefulShutdown(app);
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as Server;
    expect(process.listenerCount('SIGTERM')).toBe(listenersBefore + 1);

    await activity.recordSignIn({ id: 4, email: 'writer@example.com' });

    const drainStarted = deferred();
    const drain = activity.beforeApplicationShutdown.bind(activity);
    jest.spyOn(activity, 'beforeApplicationShutdown').mockImplementation(() => {
      drainStarted.resolve();
      return drain();
    });
    const exited = new Promise<number | string | null | undefined>((resolve) => {
      jest.spyOn(process, 'exit').mockImplementation((code) => {
        resolve(code);
        return undefined as never;
      });
    });

    process.emit('SIGTERM', 'SIGTERM');

    await drainStarted.promise;
    expect(pool.steps).toEqual([]);
    expect(server.listening).toBe(true);

    sending.resolve();
    await expect(exited).resolves.toBe(0);
    expect(pool.steps).toEqual(['email sent', 'pool closed on SIGTERM']);
    expect(server.listening).toBe(false);
    expect(process.listenerCount('SIGTERM')).toBe(listenersBefore);
  });

  it('listens to SIGTERM and SIGINT only', async () => {
    const enable = jest.spyOn(app, 'enableShutdownHooks').mockReturnValue(app);

    enableGracefulShutdown(app);

    expect(enable).toHaveBeenCalledWith([...SHUTDOWN_SIGNALS], { useProcessExit: true });
    expect(SHUTDOWN_SIGNALS).toEqual(['SIGTERM', 'SIGINT']);
  });
});

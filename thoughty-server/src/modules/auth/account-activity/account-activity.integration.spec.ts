import { AccountEvent, Setting } from '@/database/entities';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { ACCOUNT_ACTIVITY_PAGE_SIZE, AccountActivityService } from './account-activity.service';
import { runWithClientSoftware } from './client-software';

describePostgres('AccountActivityService on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let service: AccountActivityService;
  let writer = 0;
  const email = { isConfigured: () => true, sendRenderedEmail: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    const { dataSource } = database;
    service = new AccountActivityService(
      dataSource.getRepository(AccountEvent),
      dataSource.getRepository(Setting),
      email as never,
      { get: (_key: string, fallback: string) => fallback } as never,
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    email.sendRenderedEmail.mockClear();
    await database.dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    [{ id: writer }] = await database.dataSource.query(
      `INSERT INTO users (username, email, auth_provider) VALUES ('writer', 'writer@example.com', 'local') RETURNING id`,
    );
  });

  const signIn = (browser: string | null, system: string | null) =>
    runWithClientSoftware({ browser, system }, () => service.recordSignIn({ id: writer, email: 'writer@example.com' }));

  /** Signs in and waits for the email it may send in the background. */
  const signInAndSettle = async (browser: string | null, system: string | null) => {
    await signIn(browser, system);
    await service.emailsSettled();
  };

  it('emails a sign-in only from a browser and system the account has not signed in from', async () => {
    await signInAndSettle('Firefox', 'Linux');
    await signInAndSettle('Firefox', 'Linux');
    expect(email.sendRenderedEmail).not.toHaveBeenCalled();

    await signInAndSettle('Firefox', 'Windows');
    await signInAndSettle(null, null);
    await signInAndSettle(null, null);
    expect(email.sendRenderedEmail).toHaveBeenCalledTimes(2);

    await service.setNewBrowserEmail(writer, false);
    await signInAndSettle('Safari', 'iOS');
    expect(email.sendRenderedEmail).toHaveBeenCalledTimes(2);
    await expect(service.newBrowserEmailEnabled(writer)).resolves.toBe(false);
    await service.setNewBrowserEmail(writer, true);
    await expect(service.newBrowserEmailEnabled(writer)).resolves.toBe(true);
  });

  it('sends one email for two sign-ins at once from a new browser', async () => {
    await signInAndSettle('Firefox', 'Linux');
    // Opens the pool's connections first, so the two sign-ins run side by side
    await Promise.all([1, 2, 3, 4].map(() => database.dataSource.query('SELECT pg_sleep(0.05)')));
    await Promise.all([signIn('Chrome', 'macOS'), signIn('Chrome', 'macOS')]);
    await service.emailsSettled();
    expect(email.sendRenderedEmail).toHaveBeenCalledTimes(1);
    await expect(
      database.dataSource.query(`SELECT count(*)::int AS n FROM account_events WHERE browser = 'Chrome'`),
    ).resolves.toEqual([{ n: 2 }]);
  });

  it('lists the past year newest first, a page at a time, and removes what is older', async () => {
    const { dataSource } = database;
    await dataSource.query(
      `INSERT INTO account_events (user_id, kind, created_at)
       SELECT $1, 'sign_in', NOW() - (n || ' minutes')::interval FROM generate_series(1, $2) AS n`,
      [writer, ACCOUNT_ACTIVITY_PAGE_SIZE + 5],
    );
    await dataSource.query(
      `INSERT INTO account_events (user_id, kind, created_at) VALUES ($1, 'pin_set', NOW() - INTERVAL '400 days')`,
      [writer],
    );
    await runWithClientSoftware({ browser: 'Edge', system: 'Windows' }, () => service.record(writer, 'data_downloaded'));

    const first = await service.list(writer);
    expect(first.events).toHaveLength(ACCOUNT_ACTIVITY_PAGE_SIZE);
    expect(first.events[0]).toMatchObject({ kind: 'data_downloaded', browser: 'Edge', system: 'Windows' });
    const second = await service.list(writer, first.nextBefore!);
    expect(second.events).toHaveLength(6);
    expect(second.nextBefore).toBeNull();
    expect(second.events.map((event) => event.kind)).not.toContain('pin_set');

    await expect(service.purgeExpired()).resolves.toBe(1);
    await expect(dataSource.query('SELECT count(*)::int AS n FROM account_events')).resolves.toEqual([
      { n: ACCOUNT_ACTIVITY_PAGE_SIZE + 6 },
    ]);
    await expect(service.listForDownload(writer)).resolves.toHaveLength(ACCOUNT_ACTIVITY_PAGE_SIZE + 6);
  });

  it('refuses an unknown kind, and goes with the account', async () => {
    const { dataSource } = database;
    await expect(
      dataSource.query(`INSERT INTO account_events (user_id, kind) VALUES ($1, 'teleported')`, [writer]),
    ).rejects.toThrow(/chk_account_events_kind/);
    await service.record(writer, 'sign_out');
    await dataSource.query('DELETE FROM users WHERE id = $1', [writer]);
    await expect(dataSource.query('SELECT count(*)::int AS n FROM account_events')).resolves.toEqual([{ n: 0 }]);
  });
});

import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, SignUpRequest, User } from '@/database/entities';
import { AccountPurgeService } from '@/modules/account-purge/account-purge.service';
import { SignUpService } from './sign-up.service';

const PASSWORD = 'Pass123!@';

describePostgres('PostgreSQL verify-first sign-up', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: SignUpService;
  const links: string[] = [];
  const notices: string[] = [];

  /** The token of the last link emailed, as the writer would open it. */
  const lastToken = () => new URL(links[links.length - 1]!).searchParams.get('token')!;
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const sessions = { createSession: jest.fn(async (user: User, isNewUser: boolean) => ({ user, isNewUser })) };
    const email = {
      isConfigured: () => true,
      sendSignUpLinkEmail: jest.fn(async (_to: string, url: string) => { links.push(url); }),
      sendSignUpNoticeEmail: jest.fn(async (to: string) => { notices.push(to); }),
    };
    service = new SignUpService(
      dataSource.getRepository(SignUpRequest),
      dataSource.getRepository(User),
      dataSource,
      {} as never,
      sessions as never,
      email as never,
      { get: (_key: string, fallback: string) => fallback } as never,
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    links.length = 0;
    notices.length = 0;
    await dataSource.query('TRUNCATE users, sign_up_requests RESTART IDENTITY CASCADE');
  });

  it('creates the verified account and its default diary from the link once, with the chosen password', async () => {
    await service.register({ email: 'New@Example.com', password: PASSWORD, username: 'newbie' });
    await flush();
    const stored = await dataSource.getRepository(SignUpRequest).findOneByOrFail({ email: 'new@example.com' });
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.tokenHash).not.toBe(lastToken());
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    await expect(dataSource.getRepository(User).count()).resolves.toBe(0);

    await expectApiError(service.complete({ token: lastToken(), password: 'Wrong123!' }), UnauthorizedException, 'AUTH_INVALID_PASSWORD');
    const session = (await service.complete({ token: lastToken(), password: PASSWORD })) as unknown as { user: User; isNewUser: boolean };

    expect(session).toMatchObject({ isNewUser: true, user: { username: 'newbie', email: 'new@example.com', emailVerified: true, authProvider: 'local' } });
    await expect(dataSource.getRepository(Diary).findOneByOrFail({ userId: session.user.id })).resolves.toMatchObject({ name: 'Thoughts', isDefault: true });
    await expect(dataSource.getRepository(SignUpRequest).count()).resolves.toBe(0);
    await expectApiError(service.complete({ token: lastToken(), password: PASSWORD }), BadRequestException, 'AUTH_INVALID_SIGN_UP_TOKEN');
  });

  it('only notifies an address that already has an account, and creates nothing for it', async () => {
    await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com', passwordHash: 'kept' });

    await expect(service.register({ email: 'writer@example.com', password: PASSWORD })).resolves.toEqual(
      await service.register({ email: 'someone-new@example.com', password: PASSWORD }),
    );
    await flush();

    expect(notices).toEqual(['writer@example.com']);
    expect(links).toHaveLength(1);
    await expect(dataSource.getRepository(SignUpRequest).findOneByOrFail({ email: 'writer@example.com' })).resolves.toMatchObject({ tokenHash: null, passwordHash: null });
    await expect(dataSource.getRepository(User).findOneByOrFail({ email: 'writer@example.com' })).resolves.toMatchObject({ passwordHash: 'kept' });
  });

  it('spaces out emails to one address and replaces the link once the interval is over', async () => {
    await service.register({ email: 'new@example.com', password: PASSWORD });
    await service.register({ email: 'new@example.com', password: 'Other123!' });
    await flush();
    expect(links).toHaveLength(1);
    const first = lastToken();

    await dataSource.query(`UPDATE sign_up_requests SET last_sent_at = now() - interval '2 minutes'`);
    await service.register({ email: 'new@example.com', password: 'Other123!' });
    await flush();

    expect(links).toHaveLength(2);
    await expect(dataSource.getRepository(SignUpRequest).findOneByOrFail({ email: 'new@example.com' })).resolves.toMatchObject({ sentCount: 2 });
    await expectApiError(service.complete({ token: first, password: PASSWORD }), BadRequestException, 'AUTH_INVALID_SIGN_UP_TOKEN');
    await expect(service.complete({ token: lastToken(), password: 'Other123!' })).resolves.toBeDefined();
  });

  it('keeps the link when the chosen username is taken and takes another one', async () => {
    await dataSource.getRepository(User).save({ username: 'taken', email: 'first@example.com' });
    await service.register({ email: 'new@example.com', password: PASSWORD, username: 'taken' });
    await flush();

    await expectApiError(service.complete({ token: lastToken(), password: PASSWORD }), ConflictException, 'AUTH_USERNAME_TAKEN');
    await expect(service.complete({ token: lastToken(), password: PASSWORD, username: 'free' })).resolves.toMatchObject({
      user: { username: 'free' },
    });
  });

  it('gives the name before the @ a number when another writer has it', async () => {
    await dataSource.getRepository(User).save({ username: 'new', email: 'first@example.com' });
    await service.register({ email: 'new@example.com', password: PASSWORD });
    await flush();

    const session = (await service.complete({ token: lastToken(), password: PASSWORD })) as unknown as { user: User };

    expect(session.user.username).toMatch(/^new-\d{6}$/);
  });

  it('lets only one of two requests racing on the same link create the account', async () => {
    await service.register({ email: 'new@example.com', password: PASSWORD });
    await flush();

    const results = await Promise.allSettled([
      service.complete({ token: lastToken(), password: PASSWORD }),
      service.complete({ token: lastToken(), password: PASSWORD }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await expect(dataSource.getRepository(User).count()).resolves.toBe(1);
  });

  it('refuses an expired link, and the worker purges the expired requests', async () => {
    await service.register({ email: 'new@example.com', password: PASSWORD });
    await service.register({ email: 'other@example.com', password: PASSWORD });
    await flush();
    await dataSource.query(`UPDATE sign_up_requests SET expires_at = now() - interval '1 second' WHERE email = 'other@example.com'`);

    await expectApiError(service.complete({ token: lastToken(), password: PASSWORD }), BadRequestException, 'AUTH_INVALID_SIGN_UP_TOKEN');
    const purge = new AccountPurgeService(dataSource, {} as never);
    await expect(purge.purgeExpiredSignUps()).resolves.toBe(1);
    await expect(dataSource.getRepository(SignUpRequest).find()).resolves.toEqual([expect.objectContaining({ email: 'new@example.com' })]);
  });
});

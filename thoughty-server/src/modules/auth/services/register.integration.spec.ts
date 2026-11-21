import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { DataSource, Repository } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, User } from '@/database/entities';
import { AuthService } from './auth.service';
import { freeUsername } from './free-username';
import { ProviderAccountService } from './provider-account.service';
import { createAccountActivityMock } from '../account-activity/account-activity.test-helpers';

const PASSWORD = 'Pass123!@';

describePostgres('PostgreSQL registration without email and case-insensitive usernames', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let users: Repository<User>;
  let auth: AuthService;
  let providerAccounts: ProviderAccountService;

  const register = (email: string, username?: string) => auth.register({ email, password: PASSWORD, username });

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    users = dataSource.getRepository(User);
    providerAccounts = new ProviderAccountService(users, dataSource);
    const sessions = { createSession: jest.fn(async (user: User) => ({ user })) };
    auth = new AuthService(users, dataSource, sessions as never, {} as never, {} as never, providerAccounts, createAccountActivityMock() as never);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  it('lets one of several racing registrations of an address through and answers the others 409', async () => {
    const results = await Promise.allSettled(
      ['one', 'two', 'three', 'four'].map((name) => register(name === 'one' ? 'race@example.com' : 'Race@Example.com', name)),
    );

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    for (const result of results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')) {
      await expectApiError(Promise.reject(result.reason), ConflictException, 'AUTH_EMAIL_TAKEN');
    }
    await expect(users.count()).resolves.toBe(1);
    await expect(dataSource.getRepository(Diary).count()).resolves.toBe(1);
  });

  it('lets one of several racing registrations of a username, in any case, through', async () => {
    const results = await Promise.allSettled(
      ['Jane', 'jane', 'JANE', 'jAnE'].map((name, n) => register(`jane${n}@example.com`, name)),
    );

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    for (const result of results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')) {
      await expectApiError(Promise.reject(result.reason), ConflictException, 'AUTH_USERNAME_TAKEN');
    }
    await expect(users.count()).resolves.toBe(1);
    await expect(dataSource.getRepository(Diary).count()).resolves.toBe(1);
  });

  it('refuses a username another account has in another case, and numbers a generated one', async () => {
    await register('jane@example.com', 'Jane Doe');

    await expectApiError(register('other@example.com', 'jane doe'), ConflictException, 'AUTH_USERNAME_TAKEN');
    await expectApiError(register('JANE@example.com', 'someone'), ConflictException, 'AUTH_EMAIL_TAKEN');
    await register('jane.doe@example.com', 'JANE.DOE');
    const generated = (await register('Jane.Doe@elsewhere.com')) as unknown as { user: User };
    expect(generated.user.username).toMatch(/^jane\.doe-\d{6}$/);
    await expect(freeUsername(users, 'JANE DOE')).resolves.toMatch(/^JANE DOE-\d{6}$/);
  });

  it('gives a Google "Jane Doe" a number when "jane doe" exists', async () => {
    await register('jane@example.com', 'jane doe');

    const { user } = await providerAccounts.signIn({
      provider: 'google',
      subject: 'google-jane',
      email: 'jane.doe@gmail.com',
      suggestedUsername: 'Jane Doe',
    });

    expect(user.username).toMatch(/^Jane Doe-\d{6}$/);
  });

  it('signs in by username in any case, and by address before a username that reads the same', async () => {
    const jane = (await register('jane@example.com', 'Jane')) as unknown as { user: User };
    // An older account whose name is another account's address (a Keycloak `preferred_username`)
    await users.save({ username: 'Jane@Example.com', email: 'keycloak@example.com', passwordHash: await bcrypt.hash('Other123!', 4) });
    const login = (identifier: string, password = PASSWORD) =>
      auth.login({ identifier, password }) as unknown as Promise<{ user: User }>;

    await expect(login(' jANE ')).resolves.toMatchObject({ user: { id: jane.user.id } });
    await expect(login('JANE@EXAMPLE.COM')).resolves.toMatchObject({ user: { id: jane.user.id } });
    await expect(login('jane@example.com', 'Other123!')).rejects.toMatchObject({ response: { code: 'AUTH_INVALID_CREDENTIALS' } });
  });
});

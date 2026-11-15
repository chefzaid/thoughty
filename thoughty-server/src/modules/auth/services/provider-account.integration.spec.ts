import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, RefreshToken, Setting, SignUpRequest, User } from '@/database/entities';
import { ProviderAccountService, type ProviderIdentity } from './provider-account.service';

const janeDoe = (n: number): ProviderIdentity => ({
  provider: 'google',
  subject: `google-sub-${n}`,
  email: `jane${n}@example.com`,
  suggestedUsername: 'Jane Doe',
});

describePostgres('PostgreSQL Google and Keycloak accounts', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: ProviderAccountService;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new ProviderAccountService(dataSource.getRepository(User), dataSource);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users, sign_up_requests RESTART IDENTITY CASCADE');
  });

  it('gives each of several "Jane Doe"s signing in at once a free username of their own', async () => {
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => service.signIn(janeDoe(n))));

    const usernames = results.map(({ user }) => user.username);
    expect(new Set(usernames).size).toBe(5);
    expect(usernames).toContain('Jane Doe');
    for (const username of usernames.filter((name) => name !== 'Jane Doe')) {
      expect(username).toMatch(/^Jane Doe-\d{6}$/);
    }
    expect(results.every(({ isNewUser }) => isNewUser)).toBe(true);
    await expect(dataSource.getRepository(Diary).count({ where: { isDefault: true } })).resolves.toBe(5);
  });

  it('creates one account when the same identity signs in twice at once', async () => {
    const [first, second] = await Promise.all([service.signIn(janeDoe(1)), service.signIn(janeDoe(1))]);

    expect(first.user.id).toBe(second.user.id);
    await expect(dataSource.getRepository(User).count()).resolves.toBe(1);
    await expect(dataSource.getRepository(Diary).count()).resolves.toBe(1);
  });

  it("takes over an unverified account for the provider's user and drops its registrant's ways in", async () => {
    const users = dataSource.getRepository(User);
    const registrant = await users.save({
      username: 'registrant',
      email: 'victim@example.com',
      passwordHash: '$2b$12$registrant',
      emailVerified: false,
      resetToken: 'reset-hash',
      resetTokenExpires: new Date(Date.now() + 60_000),
    });
    await dataSource.getRepository(Diary).save({ userId: registrant.id, name: 'Thoughts', isDefault: true });
    await dataSource.getRepository(RefreshToken).save({ userId: registrant.id, tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() + 60_000) });
    await dataSource.getRepository(Setting).save([
      { userId: registrant.id, key: 'cloud_dropbox_refresh_token', value: 'registrant-drive' },
      { userId: registrant.id, key: 'cloud_dropbox_sync_enabled', value: 'true' },
      { userId: registrant.id, key: 'theme', value: 'dark' },
      { userId: registrant.id, key: 'cloudless', value: 'kept' },
    ]);
    await dataSource.getRepository(SignUpRequest).save({ email: 'victim@example.com', lastSentAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });

    const { user, isNewUser } = await service.signIn({ provider: 'keycloak', subject: 'kc-victim', email: 'victim@example.com' });

    expect(isNewUser).toBe(false);
    expect(user.id).toBe(registrant.id);
    await expect(users.findOneByOrFail({ id: registrant.id })).resolves.toMatchObject({
      authProvider: 'keycloak',
      providerId: 'kc-victim',
      emailVerified: true,
      passwordHash: null,
      resetToken: null,
      twoFactorEnabled: false,
    });
    await expect(dataSource.getRepository(RefreshToken).count()).resolves.toBe(0);
    await expect(dataSource.getRepository(SignUpRequest).count()).resolves.toBe(0);
    const settings = await dataSource.getRepository(Setting).find({ order: { key: 'ASC' } });
    expect(settings.map(({ key }) => key)).toEqual(['cloudless', 'theme']);
    await expect(dataSource.getRepository(Diary).count({ where: { userId: registrant.id } })).resolves.toBe(1);

    // From now on the subject finds the account, whatever address the provider sends
    const again = await service.signIn({ provider: 'keycloak', subject: 'kc-victim', email: 'renamed@example.com' });
    expect(again).toMatchObject({ isNewUser: false, user: { id: registrant.id, email: 'victim@example.com' } });
  });

  it('links a verified account and keeps its password and sessions', async () => {
    const owner = await dataSource.getRepository(User).save({
      username: 'owner',
      email: 'owner@example.com',
      passwordHash: '$2b$12$owner',
      emailVerified: true,
    });
    await dataSource.getRepository(RefreshToken).save({ userId: owner.id, tokenHash: 'b'.repeat(64), expiresAt: new Date(Date.now() + 60_000) });

    await service.signIn({ provider: 'google', subject: 'google-owner', email: 'owner@example.com' });

    await expect(dataSource.getRepository(User).findOneByOrFail({ id: owner.id })).resolves.toMatchObject({
      authProvider: 'google',
      providerId: 'google-owner',
      passwordHash: '$2b$12$owner',
    });
    await expect(dataSource.getRepository(RefreshToken).count()).resolves.toBe(1);
  });
});

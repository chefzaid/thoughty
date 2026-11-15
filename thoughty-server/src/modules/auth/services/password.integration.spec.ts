import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { RefreshToken, User } from '@/database/entities';
import { PasswordService } from './password.service';

const NEW_PASSWORD = 'Reset123!@';

describePostgres('PostgreSQL password reset', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: PasswordService;
  const links: string[] = [];

  /** The token of the last link emailed, as the writer would open it. */
  const lastToken = () => new URL(links[links.length - 1]!).searchParams.get('token')!;
  /** Waits for the background token write and email of `forgotPassword`. */
  const emailed = async (count: number) => {
    for (let attempt = 0; attempt < 50 && links.length < count; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(links).toHaveLength(count);
  };
  const users = () => dataSource.getRepository(User);

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const email = {
      sendPasswordResetEmail: jest.fn(async (_to: string, url: string) => { links.push(url); }),
    };
    service = new PasswordService(
      dataSource.getRepository(User),
      dataSource.getRepository(RefreshToken),
      { get: (_key: string, fallback: string) => fallback } as never,
      email as never,
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  let writer: User;

  beforeEach(async () => {
    links.length = 0;
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    writer = await users().save({
      email: 'writer@example.com',
      username: 'writer',
      passwordHash: await bcrypt.hash('Old123!@', 4),
      authProvider: 'local',
      emailVerified: true,
      twoFactorEnabled: true,
    });
    await dataSource.getRepository(RefreshToken).save([
      { userId: writer.id, tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() + 60_000) },
      { userId: writer.id, tokenHash: 'b'.repeat(64), expiresAt: new Date(Date.now() + 60_000) },
    ]);
  });

  it('resets once from the emailed link, signs every session out and drops a pending sign-in code', async () => {
    await users().update(writer.id, {
      twoFactorChallengeTokenHash: 'c'.repeat(64),
      twoFactorChallengeCodeHash: 'd'.repeat(64),
      twoFactorChallengePurpose: 'login',
      twoFactorChallengeExpires: new Date(Date.now() + 60_000),
    });
    await service.forgotPassword('Writer@Example.com');
    await emailed(1);

    await expect(service.resetPassword(lastToken(), NEW_PASSWORD)).resolves.toMatchObject({ success: true });

    const stored = await users().findOneByOrFail({ id: writer.id });
    expect(await bcrypt.compare(NEW_PASSWORD, stored.passwordHash!)).toBe(true);
    expect(stored).toMatchObject({
      resetToken: null,
      resetTokenExpires: null,
      twoFactorEnabled: true,
      twoFactorChallengeTokenHash: null,
      twoFactorChallengeCodeHash: null,
      twoFactorChallengePurpose: null,
      twoFactorChallengeExpires: null,
    });
    await expect(dataSource.getRepository(RefreshToken).countBy({ userId: writer.id })).resolves.toBe(0);
    await expectApiError(service.resetPassword(lastToken(), 'Again123!@'), BadRequestException, 'AUTH_INVALID_RESET_TOKEN');
  });

  it('lets only one of two racing requests use a link', async () => {
    await service.forgotPassword(writer.email);
    await emailed(1);

    const results = await Promise.allSettled([
      service.resetPassword(lastToken(), 'First123!@'),
      service.resetPassword(lastToken(), 'Second123!@'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('refuses an expired link, an earlier link once a new one is sent, and a deleted account', async () => {
    await service.forgotPassword(writer.email);
    await emailed(1);
    const first = lastToken();
    await service.forgotPassword(writer.email);
    await emailed(2);
    await expectApiError(service.resetPassword(first, NEW_PASSWORD), BadRequestException, 'AUTH_INVALID_RESET_TOKEN');

    await users().update(writer.id, { resetTokenExpires: new Date(Date.now() - 1000) });
    await expectApiError(service.resetPassword(lastToken(), NEW_PASSWORD), BadRequestException, 'AUTH_INVALID_RESET_TOKEN');

    await users().update(writer.id, { resetTokenExpires: new Date(Date.now() + 60_000), deletedAt: new Date() });
    await expectApiError(service.resetPassword(lastToken(), NEW_PASSWORD), BadRequestException, 'AUTH_INVALID_RESET_TOKEN');

    // Nothing changed: the old password and both sessions remain
    const stored = await users().findOneByOrFail({ id: writer.id });
    expect(await bcrypt.compare('Old123!@', stored.passwordHash!)).toBe(true);
    await expect(dataSource.getRepository(RefreshToken).countBy({ userId: writer.id })).resolves.toBe(2);
  });
});

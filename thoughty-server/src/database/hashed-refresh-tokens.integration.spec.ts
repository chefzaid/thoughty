import { createHash } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthSessionService } from '@/modules/auth/services/auth-session.service';
import { RefreshToken, User } from './entities';
import { HashedRefreshTokens1786233600000 } from './migrations/1786233600000-hashed-refresh-tokens';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('HashedRefreshTokens1786233600000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('hashes existing plain-text tokens exactly as the server hashes a presented token', async () => {
    const { dataSource } = database;
    const migration = new HashedRefreshTokens1786233600000();
    const queryRunner = dataSource.createQueryRunner();
    await migration.down(queryRunner);
    const [{ id: userId }] = await dataSource.query(
      `INSERT INTO users (username, email, auth_provider) VALUES ('hash', 'hash@example.com', 'local') RETURNING id`,
    );
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.c2lnbmF0dXJl';
    await dataSource.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 day'), ($1, $2, NOW() + INTERVAL '1 day')`,
      [userId, token],
    );

    await migration.up(queryRunner);
    await queryRunner.release();

    const rows = await dataSource.query(
      `SELECT token_hash FROM refresh_tokens WHERE user_id = $1`,
      [userId],
    );
    expect(rows).toEqual([{ token_hash: createHash('sha256').update(token).digest('hex') }]);
  });

  it('rotates a refresh token once: the old token fails afterwards', async () => {
    const { dataSource } = database;
    const service = new AuthSessionService(
      dataSource.getRepository(User),
      dataSource.getRepository(RefreshToken),
      new JwtService({ secret: 'integration-access-secret' }),
      { get: () => undefined } as unknown as ConfigService,
    );
    const user = await dataSource
      .getRepository(User)
      .save({ username: 'rotate', email: 'rotate@example.com', authProvider: 'local' });
    const first = await service.createSession(user);
    const rotated = await service.refreshToken(first.refreshToken);

    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refreshToken(first.refreshToken)).rejects.toThrow(
      'Refresh token expired or revoked',
    );
    const sessions = await service.listSessions(user.id, rotated.refreshToken);
    expect(sessions).toEqual([expect.objectContaining({ current: true })]);
    await expect(service.refreshToken(rotated.refreshToken)).resolves.toHaveProperty('accessToken');
  });
});

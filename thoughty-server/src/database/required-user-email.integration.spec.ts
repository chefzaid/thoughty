import type { QueryRunner } from 'typeorm';
import { placeholderEmail } from '@/common/utils/placeholder-email.util';
import { RequiredUserEmail1790380800000 } from './migrations/1790380800000-required-user-email';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

interface Account {
  id: number;
  email: string | null;
  verified: boolean;
  token: string | null;
}

describePostgres('RequiredUserEmail1790380800000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  const migration = new RequiredUserEmail1790380800000();
  const query = (sql: string, parameters: unknown[] = []) => database.dataSource.query(sql, parameters);

  /** Runs `work` as `runPendingMigrations` does: in one transaction, constraints checked at once. */
  const inMigration = async (work: (queryRunner: QueryRunner) => Promise<void>): Promise<void> => {
    const queryRunner = database.dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query('SET CONSTRAINTS ALL IMMEDIATE');
      await work(queryRunner);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  };

  const addUser = async (username: string, email: string | null, verified = true): Promise<number> => {
    const [{ id }] = await query(
      `INSERT INTO users (username, email, auth_provider, email_verified, email_verification_token)
       VALUES ($1, $2, 'local', $3, 'pending-link') RETURNING id`,
      [username, email, verified],
    );
    return id;
  };

  const accounts = (): Promise<Account[]> =>
    query(
      `SELECT id, email, email_verified AS verified, email_verification_token AS token FROM users ORDER BY id`,
    );

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('gives accounts without an address the placeholder the app builds, requires the column, and goes back and forth', async () => {
    await inMigration((queryRunner) => migration.down(queryRunner));
    const missing = await addUser('missing', null);
    const blank = await addUser('blank', '  ');
    const real = await addUser('real', 'real@example.com');

    await inMigration((queryRunner) => migration.up(queryRunner));

    await expect(accounts()).resolves.toEqual([
      { id: missing, email: placeholderEmail(missing), verified: false, token: null },
      { id: blank, email: placeholderEmail(blank), verified: false, token: null },
      { id: real, email: 'real@example.com', verified: true, token: 'pending-link' },
    ]);
    await expect(addUser('late', null)).rejects.toThrow(/null value in column "email"/);
    await query('UPDATE users SET pending_email = $1 WHERE id = $2', ['given@example.com', missing]);

    await inMigration((queryRunner) => migration.down(queryRunner));

    expect((await accounts()).map(({ id, email }) => ({ id, email }))).toEqual([
      { id: missing, email: null },
      { id: blank, email: null },
      { id: real, email: 'real@example.com' },
    ]);
    await expect(
      query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pending_email'`),
    ).resolves.toEqual([]);

    await inMigration((queryRunner) => migration.up(queryRunner));

    expect((await accounts()).map(({ email }) => email)).toEqual([
      placeholderEmail(missing),
      placeholderEmail(blank),
      'real@example.com',
    ]);
  });
});

import type { QueryRunner } from 'typeorm';
import { CaseInsensitiveUsernames1788134400000 } from './migrations/1788134400000-case-insensitive-usernames';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('CaseInsensitiveUsernames1788134400000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  const migration = new CaseInsensitiveUsernames1788134400000();

  const addUser = async (username: string, email: string, createdAt: string, deleted = false): Promise<number> => {
    const [{ id }] = await database.dataSource.query(
      `INSERT INTO users (username, email, auth_provider, created_at, deleted_at)
       VALUES ($1, $2, 'local', $3, $4) RETURNING id`,
      [username, email, createdAt, deleted ? createdAt : null],
    );
    return id;
  };

  const usernameOf = async (id: number): Promise<string> =>
    (await database.dataSource.query('SELECT username FROM users WHERE id = $1', [id]))[0].username;

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

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    await inMigration((queryRunner) => migration.down(queryRunner));
    await database.dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  afterEach(async () => {
    const [{ applied }] = await database.dataSource.query(
      `SELECT to_regclass('uq_users_username_lower') IS NOT NULL AS applied`,
    );
    if (!applied) await inMigration((queryRunner) => migration.up(queryRunner));
  });

  it('keeps the oldest live account its username, renames and records the others, and lower-cases addresses', async () => {
    const later = await addUser('jane doe', 'Later@Example.com', '2024-03-01');
    const oldest = await addUser('Jane Doe', 'oldest@example.com', '2024-01-01');
    const deleted = await addUser('JANE DOE', 'deleted@example.com', '2023-01-01', true);
    const taken = await addUser(`jane doe-${later}`, 'taken@example.com', '2024-02-01');
    const alone = await addUser('Alone', 'alone@example.com', '2024-01-01');

    await inMigration((queryRunner) => migration.up(queryRunner));

    expect(await usernameOf(oldest)).toBe('Jane Doe');
    expect(await usernameOf(later)).toBe(`jane doe-${later}-2`);
    expect(await usernameOf(deleted)).toBe(`JANE DOE-${deleted}`);
    expect(await usernameOf(taken)).toBe(`jane doe-${later}`);
    expect(await usernameOf(alone)).toBe('Alone');
    expect(
      await database.dataSource.query(
        'SELECT user_id AS "userId", previous_username AS previous, username FROM username_renames ORDER BY user_id',
      ),
    ).toEqual([
      { userId: later, previous: 'jane doe', username: `jane doe-${later}-2` },
      { userId: deleted, previous: 'JANE DOE', username: `JANE DOE-${deleted}` },
    ]);
    expect((await database.dataSource.query('SELECT email FROM users WHERE id = $1', [later]))[0].email).toBe(
      'later@example.com',
    );

    await expect(addUser('ALONE', 'other@example.com', '2024-05-01')).rejects.toMatchObject({
      code: '23505',
      constraint: 'uq_users_username_lower',
    });
    await expect(addUser('Mixed', 'Mixed@Example.com', '2024-05-01')).rejects.toMatchObject({
      code: '23514',
      constraint: 'chk_users_email_lowercase',
    });
    await database.dataSource.query('DELETE FROM users WHERE id = $1', [later]);
    await expect(database.dataSource.query('SELECT count(*)::int AS n FROM username_renames')).resolves.toEqual([{ n: 1 }]);
  });

  it('refuses, changing nothing, when two accounts share an address ignoring case', async () => {
    const first = await addUser('first', 'Shared@Example.com', '2024-01-01');
    await addUser('second', 'shared@example.com', '2024-02-01');
    await addUser('Second', 'other@example.com', '2024-03-01');

    await expect(inMigration((queryRunner) => migration.up(queryRunner))).rejects.toThrow(
      /^1 e-mail address\(es\) belong to more than one account/,
    );

    expect((await database.dataSource.query('SELECT email FROM users WHERE id = $1', [first]))[0].email).toBe(
      'Shared@Example.com',
    );
    expect(await database.dataSource.query(`SELECT to_regclass('username_renames') AS t`)).toEqual([{ t: null }]);
    await database.dataSource.query(`UPDATE users SET email = 'first@example.com' WHERE id = $1`, [first]);
  });
});

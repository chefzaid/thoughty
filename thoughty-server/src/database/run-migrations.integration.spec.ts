import { join } from 'node:path';
import { DataSource, type MigrationInterface, type QueryRunner } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';
import { runPendingMigrations } from './run-migrations';

/** A later migration in the common shape: fill a column on every row, then require it. */
class BackfillThenRequire9999999999001 implements MigrationInterface {
  name = 'BackfillThenRequire9999999999001';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE entries ADD COLUMN reviewed BOOLEAN');
    await queryRunner.query('UPDATE entries SET reviewed = false');
    await queryRunner.query('ALTER TABLE entries ALTER COLUMN reviewed SET NOT NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE entries DROP COLUMN reviewed');
  }
}

class Failing9999999999002 implements MigrationInterface {
  name = 'Failing9999999999002';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT * FROM no_such_table');
  }
  async down(): Promise<void> {}
}

describePostgres('runPendingMigrations on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let writerId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    const { dataSource } = database;
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    [{ id: writerId }] = await dataSource.query(`INSERT INTO users (username, email) VALUES ('writer', 'writer@example.com') RETURNING id`);
    await dataSource.query(`INSERT INTO entries (user_id, date, content) VALUES ($1, '2024-05-01', 'Kept')`, [writerId]);
  });

  /** The app's migrations and `extra` ones, on the suite's database. */
  const withMigrations = (...extra: Array<new () => MigrationInterface>) =>
    new DataSource({
      ...database.dataSource.options,
      migrations: [join(__dirname, 'migrations', '*.ts'), ...extra],
    } as never).initialize();

  it('fills and alters a table the journal list reads, in one transaction, moving the writer’s version once', async () => {
    const plain = await withMigrations(BackfillThenRequire9999999999001);
    try {
      await expect(plain.runMigrations({ transaction: 'all' })).rejects.toThrow(/pending trigger events/);
    } finally {
      await plain.destroy();
    }
    const [{ version: before }] = await database.dataSource.query('SELECT version FROM entry_list_versions WHERE user_id = $1', [writerId]);

    const dataSource = await withMigrations(BackfillThenRequire9999999999001);
    try {
      const applied = await runPendingMigrations(dataSource);

      expect(applied.map((migration) => migration.name)).toEqual(['BackfillThenRequire9999999999001']);
      expect(await dataSource.query('SELECT reviewed FROM entries')).toEqual([{ reviewed: false }]);
      expect(await dataSource.query('SELECT version FROM entry_list_versions WHERE user_id = $1', [writerId]))
        .toEqual([{ version: String(Number(before) + 1) }]);
      await dataSource.undoLastMigration({ transaction: 'all' });
    } finally {
      await dataSource.destroy();
    }
  });

  it('applies nothing when one pending migration fails', async () => {
    const dataSource = await withMigrations(BackfillThenRequire9999999999001, Failing9999999999002);
    try {
      await expect(runPendingMigrations(dataSource)).rejects.toThrow(/no_such_table/);

      expect(await dataSource.showMigrations()).toBe(true);
      const columns = await dataSource.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'entries' AND column_name = 'reviewed'`,
      );
      expect(columns).toEqual([]);
    } finally {
      await dataSource.destroy();
    }
  });
});

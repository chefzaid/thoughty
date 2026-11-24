import { EntryImportedAt1790294400000 } from './migrations/1790294400000-entry-imported-at';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('EntryImportedAt1790294400000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('marks the entries an app import made at their creation time, leaves the others, and goes back', async () => {
    const query = (sql: string, parameters: unknown[] = []) => database.dataSource.query(sql, parameters);
    const queryRunner = database.dataSource.createQueryRunner();
    const migration = new EntryImportedAt1790294400000();
    await migration.down(queryRunner);
    const [{ id: userId }] = await query(
      `INSERT INTO users (username, email, auth_provider) VALUES ('writer', 'writer@example.com', 'local') RETURNING id`,
    );
    const addEntry = async (importRef: string | null, createdAt: string) => {
      const [{ id }] = await query(
        `INSERT INTO entries (user_id, date, content, import_ref, created_at) VALUES ($1, '2024-03-14', 'Text', $2, $3) RETURNING id`,
        [userId, importRef, createdAt],
      );
      return id as number;
    };
    const dayOne = await addEntry('dayone:ABC', '2026-11-01T08:00:00Z');
    const written = await addEntry(null, '2024-03-14T21:00:00Z');

    await migration.up(queryRunner);
    const importedAt = async () =>
      (await query('SELECT id, imported_at AS "importedAt" FROM entries ORDER BY id')).map(
        (row: { id: number; importedAt: Date | null }) => ({ id: row.id, importedAt: row.importedAt?.toISOString() ?? null }),
      );
    await expect(importedAt()).resolves.toEqual([
      { id: dayOne, importedAt: '2026-11-01T08:00:00.000Z' },
      { id: written, importedAt: null },
    ]);

    await migration.down(queryRunner);
    await expect(
      query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'entries' AND column_name = 'imported_at'`),
    ).resolves.toEqual([]);
    await migration.up(queryRunner);
    await queryRunner.release();
  });
});

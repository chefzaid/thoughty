import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';
import { findSchemaDrift } from './schema-drift.test-helpers';

/**
 * Drift the migrations have not resolved yet, each with the `TODO.md` entry that tracks it. The list
 * must match exactly: fixing one fails the spec until its line is removed here.
 */
const KNOWN_DRIFT: string[] = [
  // Needs Input › May `users.email` become `NOT NULL`?
  'users.email: nullable is false in the entity but true in the database',
];

describePostgres('entities against the migrated schema on PostgreSQL', () => {
  let database: PostgresTestDatabase;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('declares nothing the migrations do not build', async () => {
    expect((await findSchemaDrift(database.dataSource)).sort()).toEqual([...KNOWN_DRIFT].sort());
  });

  it('reports a missing index, a changed column, a foreign key without its cascade and an unmapped required column', async () => {
    await database.dataSource.query(`
      DROP INDEX uq_diaries_user_name;
      ALTER TABLE life_eras ALTER COLUMN start_date DROP NOT NULL;
      ALTER TABLE life_eras ALTER COLUMN name TYPE VARCHAR(60);
      ALTER TABLE life_eras DROP CONSTRAINT life_eras_user_id_fkey;
      ALTER TABLE life_eras ADD FOREIGN KEY (user_id) REFERENCES users(id);
      ALTER TABLE life_eras ADD COLUMN legacy INTEGER NOT NULL;
      DROP INDEX idx_entries_user_mood_date;
      ALTER TABLE settings DROP CONSTRAINT settings_user_id_key_key;
      DROP INDEX idx_settings_user_id_key_unique;
    `);

    const drift = await findSchemaDrift(database.dataSource);

    expect(drift.filter((problem) => !KNOWN_DRIFT.includes(problem)).sort()).toEqual([
      'diaries.uq_diaries_user_name: index missing',
      'entries.idx_entries_user_mood_date (user_id, mood, date, WHERE mood IS NOT NULL): index missing',
      'life_eras.(user_id) -> users: onDelete is CASCADE in the entity but NO ACTION in the database',
      'life_eras.legacy: NOT NULL without a default but mapped by no entity column',
      'life_eras.name: length is 50 in the entity but 60 in the database',
      'life_eras.start_date: nullable is false in the entity but true in the database',
      'settings.(user_id, key): unique key missing',
    ]);
  });
});

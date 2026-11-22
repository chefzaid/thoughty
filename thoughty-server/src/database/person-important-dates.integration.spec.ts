import { PersonImportantDates1789689600000 } from './migrations/1789689600000-person-important-dates';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('PersonImportantDates1789689600000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('moves each person’s date to their dates and, going back, keeps one date each, the birthday first', async () => {
    const query = (sql: string, parameters: unknown[] = []) => database.dataSource.query(sql, parameters);
    const queryRunner = database.dataSource.createQueryRunner();
    const migration = new PersonImportantDates1789689600000();
    await migration.down(queryRunner);
    const [{ id: userId }] = await query(
      `INSERT INTO users (username, email, auth_provider) VALUES ('writer', 'writer@example.com', 'local') RETURNING id`,
    );
    const addPerson = async (name: string, date: [string, number, number, number | null] | null) => {
      const [{ id }] = await query(
        'INSERT INTO people (user_id, name, date_kind, date_month, date_day, date_year) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [userId, name, ...(date ?? [null, null, null, null])],
      );
      return id as number;
    };
    const marie = await addPerson('Marie', ['birthday', 2, 29, 2000]);
    const paul = await addPerson('Paul', ['anniversary', 6, 2, null]);
    const zoe = await addPerson('Zoe', null);

    await migration.up(queryRunner);
    await expect(query('SELECT person_id AS "personId", kind, label, month, day, year FROM person_dates ORDER BY person_id')).resolves.toEqual([
      { personId: marie, kind: 'birthday', label: null, month: 2, day: 29, year: 2000 },
      { personId: paul, kind: 'anniversary', label: null, month: 6, day: 2, year: null },
    ]);
    await query("INSERT INTO person_dates (person_id, kind, label, month, day) VALUES ($1, 'anniversary', 'Wedding', 1, 5)", [marie]);
    await query("INSERT INTO person_dates (person_id, kind, label, month, day) VALUES ($1, 'anniversary', 'First met', 1, 5)", [paul]);

    await migration.down(queryRunner);
    await expect(query('SELECT id, date_kind AS kind, date_month AS month, date_day AS day, date_year AS year FROM people ORDER BY id')).resolves.toEqual([
      { id: marie, kind: 'birthday', month: 2, day: 29, year: 2000 },
      { id: paul, kind: 'anniversary', month: 1, day: 5, year: null },
      { id: zoe, kind: null, month: null, day: null, year: null },
    ]);
    await expect(query("SELECT to_regclass('person_dates') AS name")).resolves.toEqual([{ name: null }]);
    await migration.up(queryRunner);
    await queryRunner.release();
  });
});

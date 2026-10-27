import { EntryDiaryForeignKey1787097600000 } from './migrations/1787097600000-entry-diary-foreign-key';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('EntryDiaryForeignKey1787097600000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await database.dataSource.query(`${sql} RETURNING id`, parameters))[0].id;

  const diaryOf = async (entryId: number): Promise<number | null> =>
    (await database.dataSource.query('SELECT diary_id FROM entries WHERE id = $1', [entryId]))[0].diary_id;

  const addEntry = (userId: number, diaryId: number | null) =>
    insert(`INSERT INTO entries (user_id, diary_id, date, content) VALUES ($1, $2, '2024-01-01', 'Text')`, [userId, diaryId]);

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('moves entries of a missing or foreign diary to the writer’s default diary, then sets entries free when their diary goes', async () => {
    const { dataSource } = database;
    const migration = new EntryDiaryForeignKey1787097600000();
    const queryRunner = dataSource.createQueryRunner();
    await migration.down(queryRunner);
    const user = (name: string) =>
      insert(`INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local')`, [name, `${name}@example.com`]);
    const [writer, other, homeless] = [await user('writer'), await user('other'), await user('homeless')];
    const diary = (userId: number, name: string, isDefault: boolean) =>
      insert('INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, $3)', [userId, name, isDefault]);
    const fallback = await diary(writer, 'Thoughts', true);
    const travel = await diary(writer, 'Travel', false);
    const othersDiary = await diary(other, 'Theirs', true);
    const [kept, none, gone, foreign, stranded] = [
      await addEntry(writer, travel),
      await addEntry(writer, null),
      await addEntry(writer, 999_999),
      await addEntry(writer, othersDiary),
      await addEntry(homeless, 999_999),
    ];
    // An older database may carry a key of its own on the column, not checked against older rows
    await dataSource.query('ALTER TABLE entries ADD FOREIGN KEY (diary_id) REFERENCES diaries(id) NOT VALID');

    await queryRunner.startTransaction();
    // As `runPendingMigrations` does: the journal list triggers of later migrations fire per statement
    await queryRunner.query('SET CONSTRAINTS ALL IMMEDIATE');
    await migration.up(queryRunner);
    await queryRunner.commitTransaction();
    await queryRunner.release();

    expect([await diaryOf(kept), await diaryOf(none), await diaryOf(gone), await diaryOf(foreign), await diaryOf(stranded)])
      .toEqual([travel, null, fallback, fallback, null]);
    const keys = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'entries'::regclass AND confrelid = 'diaries'::regclass`,
    );
    expect(keys).toEqual([{ conname: 'fk_entries_diary' }]);
    await expect(addEntry(writer, 999_999)).rejects.toMatchObject({ code: '23503' });
    await dataSource.query('DELETE FROM diaries WHERE id = $1', [travel]);
    expect(await diaryOf(kept)).toBeNull();
  });
});

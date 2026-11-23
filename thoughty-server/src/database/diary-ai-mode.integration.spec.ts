import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('DiaryAiMode1790035200000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let writer = 0;
  let open = 0;
  let closed = 0;

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await database.dataSource.query(`${sql} RETURNING id`, parameters))[0].id;

  const entryIn = (diaryId: number | null): Promise<number> =>
    insert(`INSERT INTO entries (user_id, diary_id, date, content) VALUES ($1, $2, '2024-01-01', 'Text')`, [writer, diaryId]);

  const aiOff = async (entryId: number): Promise<boolean> =>
    (await database.dataSource.query('SELECT diary_ai_off FROM entries WHERE id = $1', [entryId]))[0].diary_ai_off;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    writer = await insert(`INSERT INTO users (username, email, auth_provider) VALUES ('writer', 'writer@example.com', 'local')`, []);
    open = await insert('INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, true)', [writer, 'Thoughts']);
    closed = await insert(`INSERT INTO diaries (user_id, name, ai_mode) VALUES ($1, $2, 'off')`, [writer, 'Health']);
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('gives a new diary AI on and refuses a mode it does not know', async () => {
    const [{ ai_mode: mode }] = await database.dataSource.query('SELECT ai_mode FROM diaries WHERE id = $1', [open]);
    expect(mode).toBe('on');
    await expect(database.dataSource.query(`UPDATE diaries SET ai_mode = 'local' WHERE id = $1`, [open])).rejects.toThrow(
      /chk_diaries_ai_mode/,
    );
  });

  it('copies the diary’s mode to an entry written in it, and to one without a diary as on', async () => {
    expect(await aiOff(await entryIn(closed))).toBe(true);
    expect(await aiOff(await entryIn(open))).toBe(false);
    expect(await aiOff(await entryIn(null))).toBe(false);
  });

  it('follows an entry that moves to another diary, and cannot be written by hand', async () => {
    const entryId = await entryIn(open);
    await database.dataSource.query('UPDATE entries SET diary_id = $2 WHERE id = $1', [entryId, closed]);
    expect(await aiOff(entryId)).toBe(true);
    await database.dataSource.query('UPDATE entries SET diary_ai_off = false WHERE id = $1', [entryId]);
    expect(await aiOff(entryId)).toBe(true);
    await database.dataSource.query('UPDATE entries SET diary_id = $2 WHERE id = $1', [entryId, open]);
    expect(await aiOff(entryId)).toBe(false);
  });

  it('follows the diary’s mode to every entry in it', async () => {
    const diary = await insert('INSERT INTO diaries (user_id, name) VALUES ($1, $2)', [writer, 'Work']);
    const [first, second] = [await entryIn(diary), await entryIn(diary)];
    const elsewhere = await entryIn(open);

    await database.dataSource.query(`UPDATE diaries SET ai_mode = 'off' WHERE id = $1`, [diary]);
    expect([await aiOff(first), await aiOff(second), await aiOff(elsewhere)]).toEqual([true, true, false]);

    await database.dataSource.query(`UPDATE diaries SET ai_mode = 'on' WHERE id = $1`, [diary]);
    expect([await aiOff(first), await aiOff(second)]).toEqual([false, false]);
  });
});

import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('SavedEntries1788393600000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let reader = 0;
  let author = 0;
  let diary = 0;

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await database.dataSource.query(`${sql} RETURNING id`, parameters))[0].id;

  /** A public entry by the author that the reader has saved. */
  const savedEntry = async (): Promise<number> => {
    const entryId = await insert(
      `INSERT INTO entries (user_id, diary_id, date, content, visibility) VALUES ($1, $2, '2024-01-01', 'Text', 'public')`,
      [author, diary],
    );
    await database.dataSource.query('INSERT INTO saved_entries (user_id, entry_id) VALUES ($1, $2)', [reader, entryId]);
    return entryId;
  };

  const isSaved = async (entryId: number): Promise<boolean> =>
    (await database.dataSource.query('SELECT 1 FROM saved_entries WHERE entry_id = $1', [entryId])).length > 0;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    const user = (name: string) =>
      insert(`INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local')`, [name, `${name}@example.com`]);
    [reader, author] = [await user('reader'), await user('author')];
    diary = await insert('INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, true)', [author, 'Thoughts']);
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps a save while the entry stays in the feed', async () => {
    const entryId = await savedEntry();
    await database.dataSource.query(`UPDATE entries SET content = 'Edited', visibility = 'public' WHERE id = $1`, [entryId]);
    expect(await isSaved(entryId)).toBe(true);
  });

  it.each([
    ['made private', `UPDATE entries SET visibility = 'private' WHERE id = $1`],
    ['locked with the PIN', 'UPDATE entries SET is_locked = true WHERE id = $1'],
    ['archived', 'UPDATE entries SET is_archived = true WHERE id = $1'],
    ['moderated', `UPDATE entries SET moderation_status = 'hidden' WHERE id = $1`],
    ['moved to the recycle bin', 'UPDATE entries SET deleted_at = NOW() WHERE id = $1'],
  ])('drops a save once the entry is %s', async (_change, sql) => {
    const entryId = await savedEntry();
    await database.dataSource.query(sql, [entryId]);
    expect(await isSaved(entryId)).toBe(false);
  });

  it('drops the saves of every entry in a diary locked with the PIN', async () => {
    const entryId = await savedEntry();
    await database.dataSource.query('UPDATE diaries SET is_locked = true WHERE id = $1', [diary]);
    expect(await isSaved(entryId)).toBe(false);
    await database.dataSource.query('UPDATE diaries SET is_locked = false WHERE id = $1', [diary]);
  });
});

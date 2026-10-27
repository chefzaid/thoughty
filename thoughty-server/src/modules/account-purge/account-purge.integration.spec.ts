import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { AccountPurgeService } from './account-purge.service';

const DAY_MS = 24 * 60 * 60 * 1000;

interface UserReference {
  table: string;
  column: string;
  deleteRule: string;
}

describePostgres('PostgreSQL account purge', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let removeStoredFiles: jest.Mock;
  let service: AccountPurgeService;
  const now = new Date('2026-10-23T12:00:00Z');

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    removeStoredFiles = jest.fn().mockResolvedValue([]);
    delete process.env.ACCOUNT_PURGE_AFTER_DAYS;
    service = new AccountPurgeService(dataSource, { removeStoredFiles } as never);
  });

  /** Every foreign key column that points at users, as the migrations left the schema. */
  const userReferences = (): Promise<UserReference[]> => dataSource.query(`
    SELECT c.conrelid::regclass::text AS "table", a.attname AS "column", c.confdeltype AS "deleteRule"
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass
    ORDER BY 1, 2
  `);

  const createUser = async (name: string, deletedAt: Date | null): Promise<number> => {
    const [row] = await dataSource.query(
      'INSERT INTO users (username, email, deleted_at) VALUES ($1, $2, $3) RETURNING id',
      [name, `${name}@example.com`, deletedAt],
    );
    return row.id;
  };

  /** Gives the writer a row in every table that holds user data, and returns their public entry. */
  const fillAccount = async (userId: number): Promise<{ entryId: number; requestId: number }> => {
    const one = async (sql: string, params: unknown[]) => (await dataSource.query(sql, params))[0]?.id as number;
    const diaryId = await one("INSERT INTO diaries (user_id, name, is_default, goal_type, goal_target) VALUES ($1, $2, true, 'words_per_day', 300) RETURNING id", [userId, 'Journal']);
    const entryId = await one(
      `INSERT INTO entries (user_id, diary_id, date, content, visibility) VALUES ($1, $2, '2026-01-02', 'Private thoughts', 'public') RETURNING id`,
      [userId, diaryId],
    );
    await dataSource.query(
      `INSERT INTO entries (user_id, diary_id, date, content, deleted_at) VALUES ($1, $2, '2026-01-03', 'Binned', NOW())`,
      [userId, diaryId],
    );
    await dataSource.query(`INSERT INTO entry_revisions (entry_id, user_id, content, date) VALUES ($1, $2, 'Older', '2026-01-02')`, [entryId, userId]);
    await dataSource.query(
      `INSERT INTO attachments (user_id, entry_id, original_filename, stored_filename, mimetype, size)
       VALUES ($1, $2, 'a.jpg', $3, 'image/jpeg', 1), ($1, NULL, 'b.m4a', $4, 'audio/mp4', 1)`,
      [userId, entryId, `${userId}-linked.jpg`, `${userId}-unlinked.m4a`],
    );
    await dataSource.query(`INSERT INTO settings (user_id, key, value) VALUES ($1, 'openRouterApiKey', 'encrypted')`, [userId]);
    await dataSource.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW())`, [userId, `${userId}`.padStart(64, '0')]);
    await dataSource.query(`INSERT INTO ai_chat_histories (user_id, entry_id, messages) VALUES ($1, $2, '[]')`, [userId, entryId]);
    await dataSource.query(`INSERT INTO ai_usage_events (user_id, credential_source, model) VALUES ($1, 'server', 'm')`, [userId]);
    await dataSource.query(`INSERT INTO cloud_sync_jobs (user_id, provider) VALUES ($1, 'dropbox')`, [userId]);
    await dataSource.query(
      `INSERT INTO book_versions (user_id, diary_id, scope_key, version_number, title, format, filename, content_type, content, manifest, chapter_count, entry_count, added_entry_count)
       VALUES ($1, $2, 'all', 1, 'Book', 'md', 'book.md', 'text/markdown', 'x'::bytea, '{}', 0, 0, 0)`,
      [userId, diaryId],
    );
    await dataSource.query(`INSERT INTO memoir_programs (user_id, diary_id, delivery_weekday, next_delivery_at) VALUES ($1, $2, 1, NOW())`, [userId, diaryId]);
    await dataSource.query(`INSERT INTO memoir_answers (user_id, question_id, entry_id) VALUES ($1, 'q1', $2)`, [userId, entryId]);
    await dataSource.query(
      `INSERT INTO year_review_moods (user_id, diary_id, year, months, summary, analyzed_entries) VALUES ($1, $2, 2026, '[]', 'Calm', 1)`,
      [userId, diaryId],
    );
    await dataSource.query(`INSERT INTO saved_searches (user_id, name, diary_id, filters) VALUES ($1, 'Family', $2, '{}')`, [userId, diaryId]);
    const requestId = await one(`INSERT INTO feature_requests (user_id, title, details) VALUES ($1, 'Idea', 'Details') RETURNING id`, [userId]);
    return { entryId, requestId };
  };

  /** Rows that still point at the user through any foreign key to users. */
  const remainingRows = async (userId: number): Promise<Record<string, number>> => {
    const remaining: Record<string, number> = {};
    for (const { table, column } of await userReferences()) {
      const [{ count }] = await dataSource.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE "${column}" = $1`, [userId]);
      if (count > 0) remaining[`${table}.${column}`] = count;
    }
    return remaining;
  };

  it('has every foreign key to users delete on cascade', async () => {
    const references = await userReferences();

    expect(references.length).toBeGreaterThanOrEqual(20);
    expect(references.filter((reference) => reference.deleteRule !== 'c')).toEqual([]);
  });

  it('purges an account past its grace period with all its data, files, and its marks on other writers', async () => {
    const goneId = await createUser('gone', new Date(now.getTime() - 31 * DAY_MS));
    const friendId = await createUser('friend', null);
    const gone = await fillAccount(goneId);
    const friend = await fillAccount(friendId);

    await dataSource.query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2), ($2, $1)', [goneId, friendId]);
    const [{ id: goneComment }] = await dataSource.query(
      `INSERT INTO entry_comments (entry_id, user_id, content) VALUES ($1, $2, 'From gone') RETURNING id`,
      [friend.entryId, goneId],
    );
    const [{ id: friendComment }] = await dataSource.query(
      `INSERT INTO entry_comments (entry_id, user_id, content) VALUES ($1, $2, 'On gone') RETURNING id`,
      [gone.entryId, friendId],
    );
    await dataSource.query('INSERT INTO entry_likes (entry_id, user_id) VALUES ($1, $2), ($3, $4)', [friend.entryId, goneId, gone.entryId, friendId]);
    await dataSource.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2), ($3, $4)', [goneComment, friendId, friendComment, goneId]);
    await dataSource.query('INSERT INTO feature_request_votes (feature_request_id, user_id) VALUES ($1, $2), ($3, $4)', [
      friend.requestId, goneId, gone.requestId, friendId,
    ]);

    await expect(service.purgeExpired(now)).resolves.toEqual({ purgedUserIds: [goneId], failedUserIds: [] });

    expect(removeStoredFiles).toHaveBeenCalledTimes(1);
    expect([...removeStoredFiles.mock.calls[0][0]].sort()).toEqual([`${goneId}-linked.jpg`, `${goneId}-unlinked.m4a`]);
    expect(await dataSource.query('SELECT id FROM users WHERE id = $1', [goneId])).toEqual([]);
    expect(await remainingRows(goneId)).toEqual({});

    // Nothing of the writer is left behind on what others own: their comment and the friend's
    // comment on the writer's entry, likes both ways, and votes on the writer's feature request.
    expect(await dataSource.query('SELECT content FROM entry_comments')).toEqual([]);
    expect(await dataSource.query('SELECT user_id FROM entry_likes')).toEqual([]);
    expect(await dataSource.query('SELECT user_id FROM comment_likes')).toEqual([]);
    expect(await dataSource.query('SELECT feature_request_id AS "requestId" FROM feature_request_votes')).toEqual([]);
    expect(await dataSource.query('SELECT follower_id FROM user_follows')).toEqual([]);
    expect(await dataSource.query('SELECT id FROM feature_requests')).toEqual([{ id: friend.requestId }]);

    // The friend's own account is untouched.
    expect(await remainingRows(friendId)).toEqual(expect.objectContaining({
      'entries.user_id': 2,
      'attachments.user_id': 2,
      'settings.user_id': 1,
      'feature_requests.user_id': 1,
    }));
  });

  it('keeps live accounts and accounts still inside the grace period', async () => {
    const liveId = await createUser('live', null);
    const recentId = await createUser('recent', new Date(now.getTime() - 29 * DAY_MS));
    await fillAccount(liveId);
    await fillAccount(recentId);

    await expect(service.purgeExpired(now)).resolves.toEqual({ purgedUserIds: [], failedUserIds: [] });

    expect(removeStoredFiles).not.toHaveBeenCalled();
    expect((await dataSource.query('SELECT id FROM users ORDER BY id')).map((row: { id: number }) => row.id)).toEqual([liveId, recentId]);
    expect(await remainingRows(recentId)).toEqual(expect.objectContaining({ 'entries.user_id': 2 }));
  });

  it('uses the configured grace period', async () => {
    process.env.ACCOUNT_PURGE_AFTER_DAYS = '7';
    service = new AccountPurgeService(dataSource, { removeStoredFiles } as never);
    const weekOldId = await createUser('week-old', new Date(now.getTime() - 8 * DAY_MS));

    await expect(service.purgeExpired(now)).resolves.toEqual({ purgedUserIds: [weekOldId], failedUserIds: [] });
  });
});

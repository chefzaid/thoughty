import { RequiredColumns1787184000000 } from './migrations/1787184000000-required-columns';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('RequiredColumns1787184000000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('fills the nulls older rows hold with the defaults, keeps their other values, then refuses new nulls', async () => {
    const { dataSource } = database;
    const migration = new RequiredColumns1787184000000();
    const queryRunner = dataSource.createQueryRunner();
    await migration.down(queryRunner);
    const [{ id: userId }] = await dataSource.query(`
      INSERT INTO users (username, email, auth_provider, email_verified, created_at, updated_at)
      VALUES ('old', 'old@example.com', NULL, NULL, NULL, '2023-05-06 07:08:09') RETURNING id`);
    const [{ id: diaryId }] = await dataSource.query(
      `INSERT INTO diaries (user_id, name, icon, visibility, is_default, position, created_at)
       VALUES ($1, 'Old', NULL, NULL, NULL, NULL, NULL) RETURNING id`,
      [userId],
    );
    const [{ id: entryId }] = await dataSource.query(
      `INSERT INTO entries (user_id, diary_id, date, content, "index", tags, format, visibility, is_favorite, is_archived, is_pinned, created_at, updated_at)
       VALUES ($1, $2, '2022-02-03', 'Kept text', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL) RETURNING id`,
      [userId, diaryId],
    );
    await dataSource.query(
      `INSERT INTO settings (user_id, key, value, updated_at) VALUES ($1, 'theme', 'dark', NULL)`,
      [userId],
    );

    await queryRunner.startTransaction();
    await migration.up(queryRunner);
    await queryRunner.commitTransaction();
    await queryRunner.release();

    const [user] = await dataSource.query(
      `SELECT auth_provider, email_verified, created_at::text, updated_at::text FROM users WHERE id = $1`,
      [userId],
    );
    expect(user).toEqual({
      auth_provider: 'local',
      email_verified: false,
      created_at: '2023-05-06 07:08:09',
      updated_at: '2023-05-06 07:08:09',
    });
    const [diary] = await dataSource.query(
      'SELECT name, icon, visibility, is_default, position, created_at IS NOT NULL AS dated FROM diaries WHERE id = $1',
      [diaryId],
    );
    expect(diary).toEqual({ name: 'Old', icon: '📓', visibility: 'private', is_default: false, position: 0, dated: true });
    const [entry] = await dataSource.query(
      `SELECT content, "index", tags, format, visibility, is_favorite, is_archived, is_pinned, created_at::text
         FROM entries WHERE id = $1`,
      [entryId],
    );
    expect(entry).toEqual({
      content: 'Kept text',
      index: 1,
      tags: [],
      format: 'plain',
      visibility: 'private',
      is_favorite: false,
      is_archived: false,
      is_pinned: false,
      created_at: '2022-02-03 00:00:00',
    });
    const [setting] = await dataSource.query('SELECT value, updated_at IS NOT NULL AS dated FROM settings WHERE user_id = $1', [userId]);
    expect(setting).toEqual({ value: 'dark', dated: true });

    await expect(
      dataSource.query(`INSERT INTO entries (user_id, date, content, is_pinned) VALUES ($1, '2024-01-01', 'New', NULL)`, [userId]),
    ).rejects.toMatchObject({ code: '23502' });
    const [{ icon }] = await dataSource.query(`INSERT INTO diaries (user_id, name) VALUES ($1, 'New') RETURNING icon`, [userId]);
    expect(icon).toBe('📓');
  });
});

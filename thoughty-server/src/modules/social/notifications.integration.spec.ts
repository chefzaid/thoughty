import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { NotificationRead } from '@/database/entities';
import { NotificationsService } from './notifications.service';

describePostgres('Notifications on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let notifications: NotificationsService;
  const ids = { alice: 0, bob: 0, carol: 0, dan: 0 };
  const entries = { alicePublic: 0, alicePrivate: 0, bob: 0 };
  const comments = { bobOnAlice: 0, carolOnAlice: 0, aliceOnBob: 0 };

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await dataSource.query(`${sql} RETURNING id`, parameters))[0].id;
  const keys = async (userId: number) =>
    (await notifications.list(userId)).notifications.map((notification) => notification.id);

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    for (const name of Object.keys(ids) as (keyof typeof ids)[]) {
      ids[name] = await insert(
        `INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local')`,
        [name, `${name}@example.com`],
      );
    }
    const diary = async (userId: number) =>
      insert('INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, true)', [userId, 'Thoughts']);
    const aliceDiary = await diary(ids.alice);
    const entry = (userId: number, diaryId: number, visibility: string, title: string | null) =>
      insert(
        `INSERT INTO entries (user_id, diary_id, date, content, visibility, title) VALUES ($1, $2, '2026-11-20', 'Text', $3, $4)`,
        [userId, diaryId, visibility, title],
      );
    entries.alicePublic = await entry(ids.alice, aliceDiary, 'public', 'Morning walk');
    entries.alicePrivate = await entry(ids.alice, aliceDiary, 'private', null);
    entries.bob = await entry(ids.bob, await diary(ids.bob), 'public', null);

    const comment = (entryId: number, userId: number, content: string, at: string) =>
      insert('INSERT INTO entry_comments (entry_id, user_id, content, created_at) VALUES ($1, $2, $3, $4)', [
        entryId,
        userId,
        content,
        at,
      ]);
    comments.bobOnAlice = await comment(entries.alicePublic, ids.bob, `A thought ${'x'.repeat(200)}`, '2024-01-02 08:00');
    comments.carolOnAlice = await comment(entries.alicePublic, ids.carol, 'From carol', '2024-01-02 08:05');
    comments.aliceOnBob = await comment(entries.bob, ids.alice, 'Alice says hi', '2024-01-02 07:00');
    await comment(entries.alicePublic, ids.alice, 'Alice answers', '2024-01-02 09:00');

    await dataSource.query(
      `INSERT INTO entry_likes (entry_id, user_id, created_at) VALUES ($1, $2, '2024-01-02 08:10'), ($3, $2, '2024-01-02 08:20')`,
      [entries.alicePublic, ids.dan, entries.alicePrivate],
    );
    await dataSource.query(
      `INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES ($1, $2, '2024-01-02 08:15')`,
      [comments.aliceOnBob, ids.bob],
    );
    await dataSource.query(
      `INSERT INTO user_follows (follower_id, followed_id, created_at) VALUES ($1, $2, '2024-01-02 08:30')`,
      [ids.carol, ids.alice],
    );

    notifications = new NotificationsService(dataSource.getRepository(NotificationRead));
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('tells a writer about comments and likes on their public entries, likes on their comments and new followers', async () => {
    const result = await notifications.list(ids.alice);

    // Newest first; the like on the private entry and alice's own comment are not news to her
    expect(result.notifications.map((notification) => notification.id)).toEqual([
      `follow:${ids.carol}`,
      `commentLike:${comments.aliceOnBob}:${ids.bob}`,
      `entryLike:${entries.alicePublic}:${ids.dan}`,
      `comment:${comments.carolOnAlice}`,
      `comment:${comments.bobOnAlice}`,
    ]);
    expect(result.unreadCount).toBe(5);
    expect(result.notifications.every((notification) => notification.unread)).toBe(true);
    const bobComment = result.notifications[4];
    expect(bobComment).toEqual(
      expect.objectContaining({
        type: 'comment',
        actor: { id: ids.bob, username: 'bob', avatarUrl: null },
        entry: { id: entries.alicePublic, date: '2026-11-20', index: 1, title: 'Morning walk' },
      }),
    );
    expect(bobComment.comment?.excerpt).toHaveLength(140);
    expect(result.notifications[1].entry).toEqual(expect.objectContaining({ id: entries.bob, title: null }));
    expect(result.notifications[1].comment).toEqual({ id: comments.aliceOnBob, excerpt: 'Alice says hi' });
    expect(await keys(ids.bob)).toEqual([`comment:${comments.aliceOnBob}`]);
  });

  it('marks everything read once opened, and counts only what comes after', async () => {
    await notifications.markRead(ids.alice);
    expect(await notifications.countUnread(ids.alice)).toBe(0);
    expect((await notifications.list(ids.alice)).notifications.some((notification) => notification.unread)).toBe(false);

    await dataSource.query('INSERT INTO entry_likes (entry_id, user_id) VALUES ($1, $2)', [entries.alicePublic, ids.carol]);
    await notifications.markRead(ids.alice);
    await dataSource.query('INSERT INTO entry_likes (entry_id, user_id) VALUES ($1, $2)', [entries.alicePublic, ids.bob]);

    const result = await notifications.list(ids.alice);
    expect(result.unreadCount).toBe(1);
    expect(result.notifications[0]).toEqual(
      expect.objectContaining({ id: `entryLike:${entries.alicePublic}:${ids.bob}`, unread: true }),
    );
    expect(result.notifications[1]).toEqual(
      expect.objectContaining({ id: `entryLike:${entries.alicePublic}:${ids.carol}`, unread: false }),
    );
    expect(await notifications.countUnread(ids.alice)).toBe(1);
  });

  it('leaves out muted and blocked writers, hidden comments, deleted accounts and entries the feed no longer shows', async () => {
    await dataSource.query('INSERT INTO user_mutes (user_id, muted_id) VALUES ($1, $2)', [ids.alice, ids.carol]);
    await dataSource.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)', [ids.dan, ids.alice]);
    await dataSource.query('UPDATE entry_comments SET hidden_at = now() WHERE id = $1', [comments.bobOnAlice]);

    expect(await keys(ids.alice)).toEqual([
      `entryLike:${entries.alicePublic}:${ids.bob}`,
      `commentLike:${comments.aliceOnBob}:${ids.bob}`,
    ]);

    // Bob's entry leaves the feed, so the like on alice's comment there goes; then bob's account goes
    await dataSource.query("UPDATE entries SET visibility = 'private' WHERE id = $1", [entries.bob]);
    expect(await keys(ids.alice)).toEqual([`entryLike:${entries.alicePublic}:${ids.bob}`]);
    await dataSource.query('UPDATE users SET deleted_at = now() WHERE id = $1', [ids.bob]);
    expect(await keys(ids.alice)).toEqual([]);
    expect(await notifications.countUnread(ids.alice)).toBe(0);
  });

  it('keeps one read time per account, gone with it', async () => {
    await notifications.markRead(ids.dan);
    await dataSource.query('DELETE FROM users WHERE id = $1', [ids.dan]);

    expect(await dataSource.query('SELECT user_id FROM notification_reads WHERE user_id = $1', [ids.dan])).toEqual([]);
  });
});

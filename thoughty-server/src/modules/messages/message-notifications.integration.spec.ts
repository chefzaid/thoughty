import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { NotificationRead } from '@/database/entities';
import { MessageEntries1790899200000 } from '@/database/migrations/1790899200000-message-entries';
import { NotificationsService } from '../social/notifications.service';
import { ConversationsService } from './conversations.service';

describePostgres('Message notifications and shared entries on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let conversations: ConversationsService;
  let notifications: NotificationsService;
  const ids = { alice: 0, bob: 0, carol: 0 };
  const entries = { public: 0, private: 0, bobs: 0 };

  const query = (sql: string, parameters: unknown[] = []) => dataSource.query(sql, parameters);
  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await query(`${sql} RETURNING id`, parameters))[0].id;
  const followEachOther = (left: number, right: number) =>
    query(
      `INSERT INTO user_follows (follower_id, followed_id, status) VALUES ($1, $2, 'approved'), ($2, $1, 'approved')`,
      [left, right],
    );
  const messageNotifications = async (userId: number) =>
    (await notifications.list(userId)).notifications.filter(
      (notification) => notification.type === 'message',
    );

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    for (const name of Object.keys(ids) as (keyof typeof ids)[]) {
      ids[name] = await insert(
        `INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local')`,
        [name, `${name}@example.com`],
      );
    }
    const entry = async (userId: number, visibility: string, title: string | null) => {
      const diaryId = await insert(
        'INSERT INTO diaries (user_id, name, is_default) VALUES ($1, $2, false)',
        [userId, `Diary ${visibility} ${title ?? ''}`],
      );
      return insert(
        `INSERT INTO entries (user_id, diary_id, date, content, visibility, title) VALUES ($1, $2, '2026-11-20', 'Text', $3, $4)`,
        [userId, diaryId, visibility, title],
      );
    };
    entries.public = await entry(ids.alice, 'public', 'Morning walk');
    entries.private = await entry(ids.alice, 'private', null);
    entries.bobs = await entry(ids.bob, 'public', null);
    await followEachOther(ids.alice, ids.bob);
    await followEachOther(ids.alice, ids.carol);
    conversations = new ConversationsService(dataSource);
    notifications = new NotificationsService(dataSource.getRepository(NotificationRead));
    // The follows above are not news any more, so only messages count
    await notifications.markRead(ids.alice);
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('tells about a burst of messages once per conversation until it is read, and again when more come', async () => {
    const withBob = await conversations.open(ids.alice, ids.bob);
    const withCarol = await conversations.open(ids.carol, ids.alice);
    await conversations.send(ids.bob, withBob.id, 'First');
    await conversations.send(ids.bob, withBob.id, `Second ${'x'.repeat(200)}`);
    await conversations.send(ids.carol, withCarol.id, 'Hello alice');

    const listed = await messageNotifications(ids.alice);
    expect(listed.map((notification) => notification.id)).toEqual([
      `message:${withCarol.id}`,
      `message:${withBob.id}`,
    ]);
    expect(listed[1]).toEqual(
      expect.objectContaining({
        unread: true,
        actor: expect.objectContaining({ id: ids.bob, username: 'bob' }),
        entry: null,
        comment: null,
        conversation: { id: withBob.id, messageCount: 2, excerpt: `Second ${'x'.repeat(133)}` },
      }),
    );
    await expect(notifications.countUnread(ids.alice)).resolves.toBe(2);
    // Nothing for the senders
    await expect(messageNotifications(ids.bob)).resolves.toEqual([]);

    // Opening the bell makes them not new, still listed until each conversation is read
    await notifications.markRead(ids.alice);
    await expect(notifications.countUnread(ids.alice)).resolves.toBe(0);
    expect((await messageNotifications(ids.alice)).every((notification) => !notification.unread)).toBe(true);

    await conversations.markRead(ids.alice, withCarol.id);
    expect((await messageNotifications(ids.alice)).map((notification) => notification.id)).toEqual([
      `message:${withBob.id}`,
    ]);

    // A new message brings the conversation's one notification back as new, counted once
    await conversations.send(ids.bob, withBob.id, 'Third');
    const [again] = await messageNotifications(ids.alice);
    expect(again).toEqual(
      expect.objectContaining({ unread: true, conversation: expect.objectContaining({ messageCount: 3, excerpt: 'Third' }) }),
    );
    await expect(notifications.countUnread(ids.alice)).resolves.toBe(1);

    // Answering reads the conversation too, and her own message is not news to her
    await conversations.send(ids.alice, withBob.id, 'Hi bob');
    await expect(messageNotifications(ids.alice)).resolves.toEqual([]);
  });

  it('leaves out messages from a writer blocked either way, muted or whose account is deleted', async () => {
    const withBob = await conversations.open(ids.alice, ids.bob);
    await conversations.send(ids.bob, withBob.id, 'Still there?');
    expect(await messageNotifications(ids.alice)).toHaveLength(1);

    await query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)', [ids.bob, ids.alice]);
    await expect(messageNotifications(ids.alice)).resolves.toEqual([]);
    await query('DELETE FROM user_blocks');

    await query('INSERT INTO user_mutes (user_id, muted_id) VALUES ($1, $2)', [ids.alice, ids.bob]);
    await expect(messageNotifications(ids.alice)).resolves.toEqual([]);
    await query('DELETE FROM user_mutes');

    await query('UPDATE users SET deleted_at = now() WHERE id = $1', [ids.bob]);
    await expect(messageNotifications(ids.alice)).resolves.toEqual([]);
    await query('UPDATE users SET deleted_at = NULL WHERE id = $1', [ids.bob]);
    expect(await messageNotifications(ids.alice)).toHaveLength(1);
    await conversations.markRead(ids.alice, withBob.id);
  });

  it('shares only the sender’s public entries, shown while the other writer may read them', async () => {
    const withBob = await conversations.open(ids.alice, ids.bob);

    const sent = await conversations.send(ids.alice, withBob.id, 'What do you think?', entries.public);
    expect(sent.entry).toEqual({ id: entries.public, date: '2026-11-20', index: 1, title: 'Morning walk' });
    await expect(
      conversations.send(ids.alice, withBob.id, 'And this one?', entries.private),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'MESSAGE_ENTRY_NOT_PUBLIC' }) });
    await expect(
      conversations.send(ids.alice, withBob.id, 'Not mine', entries.bobs),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ENTRY_NOT_FOUND' }) });

    const newest = async (userId: number) => (await conversations.thread(userId, withBob.id)).messages.at(-1);
    await expect(newest(ids.bob)).resolves.toEqual(
      expect.objectContaining({
        body: 'What do you think?',
        entry: expect.objectContaining({ id: entries.public }),
        entryUnavailable: false,
      }),
    );
    const [summary] = (await conversations.list(ids.bob)).conversations;
    expect(summary.lastMessage?.entry?.id).toBe(entries.public);

    // Made private, or kept to approved followers bob is not one of: no longer shared with him, still with alice
    await query(`UPDATE entries SET visibility = 'private' WHERE id = $1`, [entries.public]);
    await expect(newest(ids.bob)).resolves.toEqual(
      expect.objectContaining({ entry: null, entryUnavailable: true }),
    );
    await query(`UPDATE entries SET visibility = 'public' WHERE id = $1`, [entries.public]);
    await query('UPDATE users SET followers_by_approval = true WHERE id = $1', [ids.alice]);
    await query(`UPDATE user_follows SET status = 'pending' WHERE follower_id = $1 AND followed_id = $2`, [
      ids.bob,
      ids.alice,
    ]);
    await expect(newest(ids.bob)).resolves.toEqual(expect.objectContaining({ entryUnavailable: true }));
    await expect(newest(ids.alice)).resolves.toEqual(
      expect.objectContaining({ entry: expect.objectContaining({ id: entries.public }) }),
    );
    await query(`UPDATE user_follows SET status = 'approved' WHERE follower_id = $1 AND followed_id = $2`, [
      ids.bob,
      ids.alice,
    ]);
    await expect(newest(ids.bob)).resolves.toEqual(expect.objectContaining({ entryUnavailable: false }));

    // Deleted for good, the message stays without it
    await query('DELETE FROM entries WHERE id = $1', [entries.public]);
    await expect(newest(ids.bob)).resolves.toEqual(
      expect.objectContaining({ body: 'What do you think?', entry: null, entryUnavailable: false }),
    );
  });

  it('adds and removes the shared entry column', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const migration = new MessageEntries1790899200000();
    const column = () =>
      query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'entry_id'`,
      );
    await migration.down(queryRunner);
    await expect(column()).resolves.toEqual([]);
    await migration.up(queryRunner);
    await expect(column()).resolves.toEqual([{ column_name: 'entry_id' }]);
    await queryRunner.release();
  });
});

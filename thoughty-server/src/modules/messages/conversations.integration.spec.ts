import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { ConversationsService } from './conversations.service';

describePostgres('Conversations on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let conversations: ConversationsService;
  const ids = { alice: 0, bob: 0, carol: 0, dan: 0 };

  const follow = (follower: number, followed: number, status = 'approved') =>
    dataSource.query(
      'INSERT INTO user_follows (follower_id, followed_id, status) VALUES ($1, $2, $3)',
      [follower, followed, status],
    );
  const followEachOther = async (left: number, right: number) => {
    await follow(left, right);
    await follow(right, left);
  };

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    for (const name of Object.keys(ids) as (keyof typeof ids)[]) {
      const [row] = await dataSource.query(
        `INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local') RETURNING id`,
        [name, `${name}@example.com`],
      );
      ids[name] = row.id;
    }
    await followEachOther(ids.alice, ids.bob);
    await followEachOther(ids.alice, ids.dan);
    // Carol follows alice, who does not follow her back; alice asked to follow carol, still waiting
    await follow(ids.carol, ids.alice);
    await follow(ids.alice, ids.carol, 'pending');
    conversations = new ConversationsService(dataSource);
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('opens one conversation per pair, whoever opens it, and lists it once it has a message', async () => {
    const opened = await conversations.open(ids.alice, ids.bob);
    const again = await conversations.open(ids.bob, ids.alice);

    expect(again.id).toBe(opened.id);
    expect(opened).toEqual(
      expect.objectContaining({
        writer: expect.objectContaining({ username: 'bob' }),
        lastMessage: null,
        canWrite: true,
      }),
    );
    expect((await conversations.list(ids.alice)).conversations).toEqual([]);

    await conversations.send(ids.alice, opened.id, 'Hello bob');
    await conversations.send(ids.alice, opened.id, 'Are you there?');

    const [forBob] = (await conversations.list(ids.bob)).conversations;
    expect(forBob).toEqual(
      expect.objectContaining({
        id: opened.id,
        writer: expect.objectContaining({ id: ids.alice, username: 'alice' }),
        unreadCount: 2,
        lastMessage: expect.objectContaining({ body: 'Are you there?', mine: false }),
      }),
    );
    // Her own messages are read by the sender
    expect((await conversations.list(ids.alice)).conversations[0].unreadCount).toBe(0);
    expect(await conversations.countUnread(ids.bob)).toEqual({ unreadCount: 2 });

    const thread = await conversations.thread(ids.bob, opened.id);
    expect(thread.messages.map((message) => message.body)).toEqual(['Hello bob', 'Are you there?']);
    expect(thread.hasMore).toBe(false);
    const older = await conversations.thread(ids.bob, opened.id, thread.messages[1].id);
    expect(older.messages.map((message) => message.body)).toEqual(['Hello bob']);

    expect(await conversations.markRead(ids.bob, opened.id)).toEqual({ unreadCount: 0 });
    await conversations.send(ids.bob, opened.id, 'Here!');
    expect(await conversations.countUnread(ids.alice)).toEqual({ unreadCount: 1 });
  });

  it('lets only writers who follow each other start one, and keeps the others out', async () => {
    // Carol follows alice one way, and alice's request to carol waits
    await expect(conversations.open(ids.alice, ids.carol)).rejects.toMatchObject({ status: 404 });
    await expect(conversations.open(ids.carol, ids.alice)).rejects.toMatchObject({ status: 404 });
    await expect(conversations.open(ids.alice, 999_999)).rejects.toMatchObject({ status: 404 });

    const { id } = (await conversations.list(ids.alice)).conversations[0];
    await expect(conversations.thread(ids.carol, id)).rejects.toMatchObject({ status: 404 });
    await expect(conversations.send(ids.carol, id, 'Let me in')).rejects.toMatchObject({
      status: 404,
    });
    await expect(conversations.markRead(ids.carol, id)).rejects.toMatchObject({ status: 404 });
  });

  it('keeps a conversation readable once a follow ends, and hides it both ways while blocked', async () => {
    const { id } = await conversations.open(ids.alice, ids.dan);
    await conversations.send(ids.dan, id, 'Morning');

    await dataSource.query('DELETE FROM user_follows WHERE follower_id = $1 AND followed_id = $2', [
      ids.dan,
      ids.alice,
    ]);
    const readOnly = await conversations.thread(ids.alice, id);
    expect(readOnly.conversation.canWrite).toBe(false);
    await expect(conversations.send(ids.alice, id, 'Still there?')).rejects.toMatchObject({
      status: 403,
    });

    await dataSource.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)', [
      ids.alice,
      ids.dan,
    ]);
    expect((await conversations.list(ids.dan)).conversations).toEqual([]);
    expect(
      (await conversations.list(ids.alice)).conversations.map((row) => row.writer.username),
    ).toEqual(['bob']);
    await expect(conversations.thread(ids.dan, id)).rejects.toMatchObject({ status: 404 });
    // Dan's unread message no longer counts for alice
    await conversations.markRead(
      ids.alice,
      (await conversations.list(ids.alice)).conversations[0].id,
    );
    expect(await conversations.countUnread(ids.alice)).toEqual({ unreadCount: 0 });
    await dataSource.query('DELETE FROM user_blocks');
    expect(await conversations.countUnread(ids.alice)).toEqual({ unreadCount: 1 });
  });

  it('hides the conversations of a deleted account and removes them with it when purged', async () => {
    const { id } = (await conversations.list(ids.bob)).conversations[0];
    await dataSource.query('UPDATE users SET deleted_at = now() WHERE id = $1', [ids.alice]);
    expect((await conversations.list(ids.bob)).conversations).toEqual([]);
    expect(await conversations.countUnread(ids.bob)).toEqual({ unreadCount: 0 });

    await dataSource.query('DELETE FROM users WHERE id = $1', [ids.alice]);
    const left = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM messages WHERE conversation_id = $1',
      [id],
    );
    expect(left[0].count).toBe(0);
    expect(await dataSource.query('SELECT id FROM conversations')).toEqual([]);
  });
});

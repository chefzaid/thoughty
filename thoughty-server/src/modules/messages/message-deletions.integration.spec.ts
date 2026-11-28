import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { NotificationRead } from '@/database/entities';
import { MessageDeletions1790985600000 } from '@/database/migrations/1790985600000-message-deletions';
import { CONVERSATIONS_DOWNLOAD_SQL } from '../config/user-data-export.helpers';
import { NotificationsService } from '../social/notifications.service';
import { ConversationsService } from './conversations.service';

describePostgres('Deleting messages and conversations for oneself on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let conversations: ConversationsService;
  let notifications: NotificationsService;
  const ids = { alice: 0, bob: 0, carol: 0 };

  const query = (sql: string, parameters: unknown[] = []) => dataSource.query(sql, parameters);
  const bodies = async (userId: number, conversationId: number) =>
    (await conversations.thread(userId, conversationId)).messages.map((message) => message.body);
  const stored = async (conversationId: number) =>
    (
      (await query('SELECT body FROM messages WHERE conversation_id = $1 ORDER BY id', [
        conversationId,
      ])) as { body: string }[]
    ).map((row) => row.body);
  const downloaded = async (userId: number) =>
    ((await query(CONVERSATIONS_DOWNLOAD_SQL, [userId])) as { body: string | null }[]).map(
      (row) => row.body,
    );
  const messageNotifications = async (userId: number) =>
    (await notifications.list(userId)).notifications.filter(
      (notification) => notification.type === 'message',
    );

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    for (const name of Object.keys(ids) as (keyof typeof ids)[]) {
      const [row] = await query(
        `INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local') RETURNING id`,
        [name, `${name}@example.com`],
      );
      ids[name] = row.id;
    }
    await query(
      `INSERT INTO user_follows (follower_id, followed_id, status)
       VALUES ($1, $2, 'approved'), ($2, $1, 'approved'), ($1, $3, 'approved'), ($3, $1, 'approved')`,
      [ids.alice, ids.bob, ids.carol],
    );
    conversations = new ConversationsService(dataSource);
    notifications = new NotificationsService(dataSource.getRepository(NotificationRead));
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('deletes a message for one writer only, everywhere they read it, and for good once both did', async () => {
    const { id } = await conversations.open(ids.alice, ids.bob);
    const mine = await conversations.send(ids.alice, id, 'Lunch?');
    await conversations.send(ids.bob, id, 'Sure');
    const unread = await conversations.send(ids.bob, id, 'Where?');

    // Alice deletes a message she has not read: it leaves her thread, list, counts, bell and download
    await expect(conversations.deleteMessage(ids.alice, id, unread.id)).resolves.toEqual({
      unreadCount: 1,
    });
    await expect(bodies(ids.alice, id)).resolves.toEqual(['Lunch?', 'Sure']);
    const [summary] = (await conversations.list(ids.alice)).conversations;
    expect(summary).toEqual(
      expect.objectContaining({
        unreadCount: 1,
        lastMessage: expect.objectContaining({ body: 'Sure' }),
      }),
    );
    const [bell] = await messageNotifications(ids.alice);
    expect(bell.conversation).toEqual({ id, messageCount: 1, excerpt: 'Sure' });
    await expect(downloaded(ids.alice)).resolves.toEqual(['Lunch?', 'Sure']);
    // Bob still has it
    await expect(bodies(ids.bob, id)).resolves.toEqual(['Lunch?', 'Sure', 'Where?']);
    await expect(downloaded(ids.bob)).resolves.toEqual(['Lunch?', 'Sure', 'Where?']);

    // Her own message goes for her; bob keeps it until he deletes it too, then it is gone for good
    await conversations.deleteMessage(ids.alice, id, mine.id);
    await expect(stored(id)).resolves.toEqual(['Lunch?', 'Sure', 'Where?']);
    await conversations.deleteMessage(ids.bob, id, mine.id);
    await expect(stored(id)).resolves.toEqual(['Sure', 'Where?']);
    await expect(
      query('SELECT * FROM message_deletions WHERE message_id = $1', [mine.id]),
    ).resolves.toEqual([]);
  });

  it('answers a message already deleted, from elsewhere, or a conversation of others as missing', async () => {
    const [{ id }] = (await conversations.list(ids.alice)).conversations;
    const withCarol = await conversations.open(ids.alice, ids.carol);
    const elsewhere = await conversations.send(ids.carol, withCarol.id, 'Hi');
    const [{ id: deleted }] = (await query(
      'SELECT message_id AS id FROM message_deletions WHERE user_id = $1',
      [ids.alice],
    )) as { id: number }[];

    await expect(conversations.deleteMessage(ids.alice, id, deleted)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MESSAGE_NOT_FOUND' }),
    });
    await expect(conversations.deleteMessage(ids.alice, id, elsewhere.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(conversations.deleteMessage(ids.carol, id, deleted)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CONVERSATION_NOT_FOUND' }),
    });
    await expect(conversations.deleteConversation(ids.carol, id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('deletes a conversation for one writer until a new message brings it back with only what is newer', async () => {
    const [withCarol, withBob] = (await conversations.list(ids.alice)).conversations;
    expect(withBob.writer.username).toBe('bob');

    await expect(conversations.deleteConversation(ids.alice, withBob.id)).resolves.toEqual({
      unreadCount: 1,
    });
    expect((await conversations.list(ids.alice)).conversations.map((row) => row.id)).toEqual([
      withCarol.id,
    ]);
    await expect(bodies(ids.alice, withBob.id)).resolves.toEqual([]);
    await expect(downloaded(ids.alice)).resolves.toEqual([null, 'Hi']);
    // The single deletion it covers is folded into the conversation's mark
    await expect(
      query('SELECT * FROM message_deletions WHERE user_id = $1', [ids.alice]),
    ).resolves.toEqual([]);
    // Bob keeps the whole conversation
    await expect(bodies(ids.bob, withBob.id)).resolves.toEqual(['Sure', 'Where?']);

    await conversations.send(ids.bob, withBob.id, 'Still on?');
    const [back] = (await conversations.list(ids.alice)).conversations;
    expect(back).toEqual(
      expect.objectContaining({
        id: withBob.id,
        unreadCount: 1,
        lastMessage: expect.objectContaining({ body: 'Still on?' }),
      }),
    );
    await expect(bodies(ids.alice, withBob.id)).resolves.toEqual(['Still on?']);
    await expect(conversations.countUnread(ids.alice)).resolves.toEqual({ unreadCount: 2 });

    // Once bob deletes it too, only what alice still has is kept
    await conversations.deleteConversation(ids.bob, withBob.id);
    await expect(stored(withBob.id)).resolves.toEqual(['Still on?']);
    expect((await conversations.list(ids.bob)).conversations).toEqual([]);
  });

  it('deletes a message for good when both writers delete it at the same time', async () => {
    const withCarol = await conversations.open(ids.alice, ids.carol);
    const message = await conversations.send(ids.alice, withCarol.id, 'Both at once');

    await Promise.all([
      conversations.deleteMessage(ids.alice, withCarol.id, message.id),
      conversations.deleteMessage(ids.carol, withCarol.id, message.id),
    ]);

    await expect(stored(withCarol.id)).resolves.toEqual(['Hi']);
  });

  it('adds and removes the deletions table and the conversation mark', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const migration = new MessageDeletions1790985600000();
    const tables = () =>
      query(
        `SELECT table_name FROM information_schema.columns
          WHERE (table_name = 'conversation_members' AND column_name = 'deleted_up_to_message_id')
             OR (table_name = 'message_deletions' AND column_name = 'message_id')
          ORDER BY table_name`,
      );
    await migration.down(queryRunner);
    await expect(tables()).resolves.toEqual([]);
    await migration.up(queryRunner);
    await expect(tables()).resolves.toEqual([
      { table_name: 'conversation_members' },
      { table_name: 'message_deletions' },
    ]);
    await queryRunner.release();
  });
});

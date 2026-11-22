import { describeContract } from './contract-suite';
import { createEntry } from './contract-fixtures';

interface NotificationsBody {
  notifications: { id: string; type: string; unread: boolean; actor: { id: number }; entry: { id: number } | null }[];
  unreadCount: number;
}

describeContract('notifications', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const list = async (as: typeof context.alice) =>
    (await call('GET /api/notifications', { as, status: 200 })).body as NotificationsBody;
  let aliceEntry = 0;

  beforeAll(async () => {
    aliceEntry = await createEntry(context, context.alice, { text: 'Alice out loud', visibility: 'public' });
  });

  it('tells a writer about comments, likes and followers, and marks them read once opened', async () => {
    const { alice, bob } = context;
    expect(await list(alice)).toEqual({ notifications: [], unreadCount: 0 });

    await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    await call('PUT /api/entries/{entryId}/like', { as: bob, params: { entryId: aliceEntry }, status: 200 });
    await call('POST /api/entries/{entryId}/comments', {
      as: bob,
      params: { entryId: aliceEntry },
      json: { content: 'Lovely' },
      status: 201,
    });

    const unread = await call('GET /api/notifications/unread', { as: alice, status: 200 });
    expect(unread.body).toEqual({ unreadCount: 3 });
    const listed = await list(alice);
    expect(listed.unreadCount).toBe(3);
    expect(listed.notifications.map((notification) => notification.type).sort()).toEqual([
      'comment',
      'entryLike',
      'follow',
    ]);
    expect(listed.notifications.every((notification) => notification.actor.id === bob.id && notification.unread)).toBe(true);
    // Bob is told nothing about his own doings
    expect(await list(bob)).toEqual({ notifications: [], unreadCount: 0 });

    const read = await call('PUT /api/notifications/read', { as: alice, status: 200 });
    expect(read.body).toEqual({ unreadCount: 0 });
    expect((await call('GET /api/notifications/unread', { as: alice, status: 200 })).body).toEqual({ unreadCount: 0 });
    expect((await list(alice)).notifications.some((notification) => notification.unread)).toBe(false);

    // A like taken back takes its notification away
    await call('DELETE /api/entries/{entryId}/like', { as: bob, params: { entryId: aliceEntry }, status: 200 });
    expect((await list(alice)).notifications.map((notification) => notification.type).sort()).toEqual(['comment', 'follow']);
  });

  it('opens the entry a notification leads to in the feed, the writer’s own included', async () => {
    const feed = await call('GET /api/entries/feed', {
      as: context.alice,
      query: { entry: String(aliceEntry) },
      status: 200,
    });
    expect((feed.body as { entries: { id: number }[] }).entries.map((entry) => entry.id)).toEqual([aliceEntry]);
  });
});

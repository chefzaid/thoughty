import { describeContract, registerWriter } from './contract-suite';
import { createEntry } from './contract-fixtures';

interface Summary {
  id: number;
  writer: { id: number; username: string };
  lastMessage: { body: string; mine: boolean } | null;
  unreadCount: number;
  canWrite: boolean;
}

describeContract('conversations', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const list = async (as: typeof context.alice) =>
    (
      (await call('GET /api/conversations', { as, status: 200 })).body as {
        conversations: Summary[];
      }
    ).conversations;
  const unread = async (as: typeof context.alice) =>
    (
      (await call('GET /api/conversations/unread', { as, status: 200 })).body as {
        unreadCount: number;
      }
    ).unreadCount;

  beforeAll(async () => {
    const { alice, bob } = context;
    // Only writers in the feed can be followed
    await createEntry(context, alice, { text: 'Alice out loud', visibility: 'public' });
    await createEntry(context, bob, { text: 'Bob out loud', visibility: 'public' });
    await call('PUT /api/follows/{userId}', { as: alice, params: { userId: bob.id }, status: 200 });
    await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
  });

  it('lets two writers who follow each other write, read and mark their conversation read', async () => {
    const { alice, bob } = context;
    const opened = (
      await call('PUT /api/conversations/with/{userId}', {
        as: alice,
        params: { userId: bob.id },
        status: 200,
      })
    ).body as Summary;
    expect(opened).toEqual(
      expect.objectContaining({
        writer: expect.objectContaining({ id: bob.id }),
        lastMessage: null,
        canWrite: true,
      }),
    );
    expect(await list(bob)).toEqual([]);

    const sent = await call('POST /api/conversations/{conversationId}/messages', {
      as: alice,
      params: { conversationId: opened.id },
      json: { body: '  Coffee on Sunday?  ' },
      status: 201,
    });
    expect(sent.body).toEqual(
      expect.objectContaining({ body: 'Coffee on Sunday?', mine: true, senderId: alice.id }),
    );
    await call('POST /api/conversations/{conversationId}/messages', {
      as: alice,
      params: { conversationId: opened.id },
      json: { body: '   ' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(await unread(bob)).toBe(1);
    const [forBob] = await list(bob);
    expect(forBob).toEqual(
      expect.objectContaining({
        id: opened.id,
        unreadCount: 1,
        lastMessage: expect.objectContaining({ mine: false }),
      }),
    );

    const thread = await call('GET /api/conversations/{conversationId}', {
      as: bob,
      params: { conversationId: opened.id },
      status: 200,
    });
    const { messages, hasMore } = thread.body as {
      messages: { id: number; body: string }[];
      hasMore: boolean;
    };
    expect(messages.map((message) => message.body)).toEqual(['Coffee on Sunday?']);
    expect(hasMore).toBe(false);
    await call('GET /api/conversations/{conversationId}', {
      as: bob,
      params: { conversationId: opened.id },
      query: { before: String(messages[0].id) },
      status: 200,
    });
    await call('GET /api/conversations/{conversationId}', {
      as: bob,
      params: { conversationId: opened.id },
      query: { before: 'soon' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });

    const read = await call('PUT /api/conversations/{conversationId}/read', {
      as: bob,
      params: { conversationId: opened.id },
      status: 200,
    });
    expect(read.body).toEqual({ unreadCount: 0 });
  });

  it('keeps everyone else out: no conversation with oneself, a writer one way, or someone else’s', async () => {
    const { alice, bob } = context;
    const carol = await registerWriter(context.client, 'carol_conversations');
    await call('PUT /api/conversations/with/{userId}', {
      as: alice,
      params: { userId: alice.id },
      status: 400,
      code: 'SOCIAL_CANNOT_MESSAGE_SELF',
    });
    await call('PUT /api/conversations/with/{userId}', {
      as: carol,
      params: { userId: alice.id },
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    const [conversation] = await list(alice);
    await call('GET /api/conversations/{conversationId}', {
      as: carol,
      params: { conversationId: conversation.id },
      status: 404,
      code: 'CONVERSATION_NOT_FOUND',
    });

    // Once bob stops following alice, the conversation can still be read but not written in
    await call('DELETE /api/follows/{userId}', {
      as: bob,
      params: { userId: alice.id },
      status: 200,
    });
    expect((await list(alice))[0].canWrite).toBe(false);
    await call('POST /api/conversations/{conversationId}/messages', {
      as: alice,
      params: { conversationId: conversation.id },
      json: { body: 'Hello?' },
      status: 403,
      code: 'CONVERSATION_READ_ONLY',
    });
  });
});

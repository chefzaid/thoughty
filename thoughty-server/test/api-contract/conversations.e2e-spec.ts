import { describeContract, registerWriter } from './contract-suite';
import type { ApiErrorCode } from '../../src/common/errors/api-error-codes';
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

  it('shares only a public entry of the sender, and tells the other writer once per conversation in the bell', async () => {
    const { alice, bob } = context;
    const publicEntry = await createEntry(context, alice, {
      text: 'Shared out loud',
      title: 'River walk',
      visibility: 'public',
    });
    const privateEntry = await createEntry(context, alice, { text: 'Kept to myself' });
    const bobsEntry = await createEntry(context, bob, { text: 'Bob again', visibility: 'public' });
    const [conversation] = await list(alice);
    const send = (json: Record<string, unknown>, status: number, code?: ApiErrorCode) =>
      call('POST /api/conversations/{conversationId}/messages', {
        as: alice,
        params: { conversationId: conversation.id },
        json,
        status,
        ...(code ? { code } : {}),
      });

    const sent = await send({ body: 'What do you think?', entryId: publicEntry }, 201);
    expect(sent.body).toEqual(
      expect.objectContaining({
        entry: expect.objectContaining({ id: publicEntry, title: 'River walk', index: expect.any(Number) }),
        entryUnavailable: false,
      }),
    );
    await send({ body: 'And this?', entryId: privateEntry }, 400, 'MESSAGE_ENTRY_NOT_PUBLIC');
    await send({ body: 'Yours', entryId: bobsEntry }, 404, 'ENTRY_NOT_FOUND');
    await send({ body: 'Odd', entryId: 'soon' }, 400, 'VALIDATION_FAILED');
    await send({ body: 'One more thing' }, 201);

    const bell = await call('GET /api/notifications', { as: bob, status: 200 });
    const messages = (
      bell.body as { notifications: { id: string; type: string; conversation: unknown }[] }
    ).notifications.filter((notification) => notification.type === 'message');
    expect(messages).toEqual([
      expect.objectContaining({
        id: `message:${conversation.id}`,
        actor: expect.objectContaining({ id: alice.id }),
        entry: null,
        conversation: { id: conversation.id, messageCount: 2, excerpt: 'One more thing' },
      }),
    ]);

    await call('PUT /api/conversations/{conversationId}/read', {
      as: bob,
      params: { conversationId: conversation.id },
      status: 200,
    });
    const after = await call('GET /api/notifications', { as: bob, status: 200 });
    expect(
      (after.body as { notifications: { type: string }[] }).notifications.some(
        (notification) => notification.type === 'message',
      ),
    ).toBe(false);
  });

  it('deletes a message or the whole conversation for one writer, while the other keeps them', async () => {
    const { alice, bob } = context;
    const [conversation] = await list(alice);
    const conversationId = conversation.id;
    const thread = async (as: typeof alice) =>
      (
        (await call('GET /api/conversations/{conversationId}', {
          as,
          params: { conversationId },
          status: 200,
        })).body as { messages: { id: number; body: string }[] }
      ).messages;
    const sent = (
      await call('POST /api/conversations/{conversationId}/messages', {
        as: bob,
        params: { conversationId },
        json: { body: 'Sunday it is' },
        status: 201,
      })
    ).body as { id: number };
    expect(await unread(alice)).toBe(1);

    const deleted = await call('DELETE /api/conversations/{conversationId}/messages/{messageId}', {
      as: alice,
      params: { conversationId, messageId: sent.id },
      status: 200,
    });
    expect(deleted.body).toEqual({ unreadCount: 0 });
    expect((await thread(alice)).map((message) => message.body)).not.toContain('Sunday it is');
    expect((await thread(bob)).at(-1)?.body).toBe('Sunday it is');
    await call('DELETE /api/conversations/{conversationId}/messages/{messageId}', {
      as: alice,
      params: { conversationId, messageId: sent.id },
      status: 404,
      code: 'MESSAGE_NOT_FOUND',
    });
    await call('DELETE /api/conversations/{conversationId}/messages/{messageId}', {
      as: alice,
      params: { conversationId, messageId: 'last' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });

    const gone = await call('DELETE /api/conversations/{conversationId}', {
      as: alice,
      params: { conversationId },
      status: 200,
    });
    expect(gone.body).toEqual({ unreadCount: 0 });
    expect(await list(alice)).toEqual([]);
    expect(await thread(alice)).toEqual([]);
    expect((await list(bob))[0].lastMessage).toEqual(expect.objectContaining({ body: 'Sunday it is' }));

    // A new message brings it back for alice, holding only that one
    await call('POST /api/conversations/{conversationId}/messages', {
      as: bob,
      params: { conversationId },
      json: { body: 'Are we still on?' },
      status: 201,
    });
    expect((await list(alice))[0]).toEqual(
      expect.objectContaining({
        id: conversationId,
        unreadCount: 1,
        lastMessage: expect.objectContaining({ body: 'Are we still on?' }),
      }),
    );
    expect((await thread(alice)).map((message) => message.body)).toEqual(['Are we still on?']);
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

import { describeContract } from './contract-suite';
import type { ApiErrorCode } from '../../src/common/errors/api-error-codes';
import { createEntry } from './contract-fixtures';

describeContract('comment-controls', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  let entryId = 0;
  let privateId = 0;

  const comment = async (
    as: typeof context.alice,
    content: string,
    status = 201,
    code?: ApiErrorCode,
  ) =>
    call('POST /api/entries/{entryId}/comments', {
      as,
      params: { entryId },
      json: { content },
      status,
      code,
    });
  const listed = async (as: typeof context.alice) =>
    (await call('GET /api/entries/{entryId}/comments', { as, params: { entryId }, status: 200 }))
      .body as {
      comments: { id: number; content: string; hidden: boolean; pinned: boolean }[];
      commentPolicy: string;
      canComment: boolean;
      canModerate: boolean;
    };

  beforeAll(async () => {
    entryId = await createEntry(context, context.alice, {
      text: 'Thinking out loud',
      visibility: 'public',
    });
    privateId = await createEntry(context, context.alice, {
      text: 'Not out loud',
      visibility: 'private',
    });
  });

  it('lets the writer choose who comments, with a default in the settings', async () => {
    const { alice, bob } = context;
    await call('POST /api/config', {
      as: alice,
      json: { defaultCommentPolicy: 'followers' },
      status: 200,
    });
    await comment(bob, 'Hi', 403, 'COMMENTS_FOLLOWERS_ONLY');
    expect(await listed(bob)).toMatchObject({
      commentPolicy: 'followers',
      canComment: false,
      canModerate: false,
    });
    await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    await comment(bob, 'Following now');

    await call('PUT /api/entries/{entryId}/comment-policy', {
      as: bob,
      params: { entryId },
      json: { policy: 'closed' },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    await call('PUT /api/entries/{entryId}/comment-policy', {
      as: alice,
      params: { entryId: privateId },
      json: { policy: 'closed' },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    await call('PUT /api/entries/{entryId}/comment-policy', {
      as: alice,
      params: { entryId },
      json: { policy: 'friends' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    const closed = await call('PUT /api/entries/{entryId}/comment-policy', {
      as: alice,
      params: { entryId },
      json: { policy: 'closed' },
      status: 200,
    });
    expect(closed.body).toEqual({ commentPolicy: 'closed', canComment: false });
    await comment(bob, 'Still here?', 403, 'COMMENTS_CLOSED');
    expect((await listed(bob)).comments.map((c) => c.content)).toEqual(['Following now']);

    await call('PUT /api/entries/{entryId}/comment-policy', {
      as: alice,
      params: { entryId },
      json: { policy: 'everyone' },
      status: 200,
    });
  });

  it('hides and pins comments for the writer only', async () => {
    const { alice, bob } = context;
    const second = (await comment(bob, 'A second thought')).body as { id: number };
    const first = (await listed(alice)).comments[0];
    const params = { entryId, commentId: second.id };

    await call('PUT /api/entries/{entryId}/comments/{commentId}/hidden', {
      as: bob,
      params,
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    const hidden = await call('PUT /api/entries/{entryId}/comments/{commentId}/hidden', {
      as: alice,
      params,
      status: 200,
    });
    expect(hidden.body).toMatchObject({ id: second.id, hidden: true, pinned: false });
    // Its writer still sees it, marked hidden
    expect((await listed(bob)).comments.find((c) => c.id === second.id)).toMatchObject({
      hidden: true,
    });
    await call('PUT /api/entries/{entryId}/comments/{commentId}/pin', {
      as: alice,
      params,
      status: 400,
      code: 'COMMENT_PIN_HIDDEN',
    });
    await call('DELETE /api/entries/{entryId}/comments/{commentId}/hidden', {
      as: alice,
      params,
      status: 200,
    });

    const pinned = await call('PUT /api/entries/{entryId}/comments/{commentId}/pin', {
      as: alice,
      params,
      status: 200,
    });
    expect(pinned.body).toMatchObject({ id: second.id, pinned: true });
    expect((await listed(bob)).comments.map((c) => c.id)).toEqual([second.id, first.id]);
    await call('PUT /api/entries/{entryId}/comments/{commentId}/pin', {
      as: alice,
      params: { entryId, commentId: 999_999 },
      status: 404,
      code: 'COMMENT_NOT_FOUND',
    });
    const unpinned = await call('DELETE /api/entries/{entryId}/comments/{commentId}/pin', {
      as: alice,
      params,
      status: 200,
    });
    expect(unpinned.body).toMatchObject({ pinned: false });
    expect((await listed(bob)).comments.map((c) => c.id)).toEqual([first.id, second.id]);
  });
});

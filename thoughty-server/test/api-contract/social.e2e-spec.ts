import { describeContract, registerWriter } from './contract-suite';
import { createEntry } from './contract-fixtures';

describeContract('social', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const feedIds = async (scope: string, user = context.bob) => {
    const response = await call('GET /api/entries/feed', {
      as: user,
      query: { scope, page: '1', limit: '10' },
      status: 200,
    });
    return (response.body as { entries: { id: number }[] }).entries.map((entry) => entry.id);
  };
  let publicId = 0;
  let privateId = 0;

  beforeAll(async () => {
    publicId = await createEntry(context, context.alice, {
      text: 'Shared with everyone',
      visibility: 'public',
      tags: ['public'],
    });
    privateId = await createEntry(context, context.alice, {
      text: 'Just for me',
      visibility: 'private',
    });
  });

  it('shows public entries in the community feed, and followed writers in the following feed', async () => {
    const { alice, bob } = context;
    expect(await feedIds('community')).toContain(publicId);
    expect(await feedIds('community')).not.toContain(privateId);
    expect(await feedIds('following')).toEqual([]);
    expect(await feedIds('mine', alice)).toEqual([publicId]);
    await call('GET /api/entries/feed', {
      as: bob,
      query: { scope: 'everyone' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('GET /api/entries/feed', {
      as: bob,
      query: { scope: 'community', limit: '50' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });

    await call('PUT /api/follows/{userId}', {
      as: bob,
      params: { userId: bob.id },
      status: 400,
      code: 'SOCIAL_CANNOT_FOLLOW_SELF',
    });
    await call('PUT /api/follows/{userId}', {
      as: bob,
      params: { userId: 999_999 },
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    const followed = await call('PUT /api/follows/{userId}', {
      as: bob,
      params: { userId: alice.id },
      status: 200,
    });
    expect(followed.body).toMatchObject({ following: true });
    const follows = await call('GET /api/follows', { as: bob, status: 200 });
    expect(JSON.stringify(follows.body)).toContain(alice.username);
    expect(await feedIds('following')).toEqual([publicId]);
    const unfollowed = await call('DELETE /api/follows/{userId}', {
      as: bob,
      params: { userId: alice.id },
      status: 200,
    });
    expect(unfollowed.body).toMatchObject({ following: false });
  });

  it('comments on and likes public entries only, and lets the commenter or the entry’s author delete a comment', async () => {
    const { alice, bob } = context;
    await call('GET /api/entries/{entryId}/comments', {
      as: bob,
      params: { entryId: privateId },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    await call('POST /api/entries/{entryId}/comments', {
      as: bob,
      params: { entryId: privateId },
      json: { content: 'Peeking' },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    const posted = await call('POST /api/entries/{entryId}/comments', {
      as: bob,
      params: { entryId: publicId },
      json: { content: 'Lovely' },
      status: 201,
    });
    const commentId = (posted.body as { id: number }).id;
    const comments = await call('GET /api/entries/{entryId}/comments', {
      as: alice,
      params: { entryId: publicId },
      status: 200,
    });
    expect(JSON.stringify(comments.body)).toContain('Lovely');

    await call('PUT /api/entries/{entryId}/like', {
      as: alice,
      params: { entryId: publicId },
      status: 400,
      code: 'SOCIAL_CANNOT_LIKE_OWN_ENTRY',
    });
    await call('PUT /api/entries/{entryId}/like', {
      as: bob,
      params: { entryId: privateId },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    const liked = await call('PUT /api/entries/{entryId}/like', {
      as: bob,
      params: { entryId: publicId },
      status: 200,
    });
    expect(liked.body).toMatchObject({ liked: true, likeCount: 1 });
    const unliked = await call('DELETE /api/entries/{entryId}/like', {
      as: bob,
      params: { entryId: publicId },
      status: 200,
    });
    expect(unliked.body).toMatchObject({ liked: false, likeCount: 0 });
    await call('DELETE /api/entries/{entryId}/like', {
      as: bob,
      params: { entryId: privateId },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });

    const commentLike = { entryId: publicId, commentId };
    await call('PUT /api/entries/{entryId}/comments/{commentId}/like', {
      as: bob,
      params: commentLike,
      status: 400,
      code: 'SOCIAL_CANNOT_LIKE_OWN_COMMENT',
    });
    const likedComment = await call('PUT /api/entries/{entryId}/comments/{commentId}/like', {
      as: alice,
      params: commentLike,
      status: 200,
    });
    expect(likedComment.body).toMatchObject({ liked: true, likeCount: 1 });
    await call('DELETE /api/entries/{entryId}/comments/{commentId}/like', {
      as: alice,
      params: commentLike,
      status: 200,
    });
    await call('DELETE /api/entries/{entryId}/comments/{commentId}/like', {
      as: alice,
      params: { entryId: publicId, commentId: 999_999 },
      status: 404,
      code: 'COMMENT_NOT_FOUND',
    });

    const carol = await registerWriter(context.client, 'carol_social');
    await call('DELETE /api/entries/{entryId}/comments/{commentId}', {
      as: carol,
      params: commentLike,
      status: 404,
      code: 'COMMENT_NOT_FOUND',
    });
    await call('DELETE /api/entries/{entryId}/comments/{commentId}', {
      as: bob,
      params: commentLike,
      status: 200,
    });
  });

  it('ranks writers for each period and lists the reader’s achievements', async () => {
    const { bob } = context;
    for (const period of ['week', 'month', 'year', 'all']) {
      await call('GET /api/leaderboard', { as: bob, query: { period }, status: 200 });
    }
    await call('GET /api/leaderboard', {
      as: bob,
      query: { period: 'decade' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('GET /api/achievements', { as: context.alice, status: 200 });
  });

  it('collects feature requests and one vote per writer', async () => {
    const { alice, bob } = context;
    const created = await call('POST /api/feature-requests', {
      as: alice,
      json: {
        title: 'Dark mode for the book',
        details: 'Let the printed book use a dark theme too.',
      },
      status: 201,
    });
    const requestId = (created.body as { id: number }).id;
    await call('POST /api/feature-requests', {
      as: alice,
      json: { title: 'x', details: '' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    const voted = await call('POST /api/feature-requests/{id}/vote', {
      as: bob,
      params: { id: requestId },
      status: 201,
    });
    expect(voted.body).toMatchObject({ voted: true });
    const votes = await call('GET /api/feature-requests/votes', { as: bob, status: 200 });
    expect(JSON.stringify(votes.body)).toContain(String(requestId));
    const listed = await call('GET /api/feature-requests', { as: alice, status: 200 });
    expect(JSON.stringify(listed.body)).toContain('Dark mode for the book');
    await call('POST /api/feature-requests/{id}/vote', {
      as: bob,
      params: { id: 999_999 },
      status: 404,
      code: 'FEATURE_REQUEST_NOT_FOUND',
    });
  });
});

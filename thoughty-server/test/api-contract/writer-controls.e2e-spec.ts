import { describeContract } from './contract-suite';
import { createEntry } from './contract-fixtures';

describeContract('writer-controls', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const communityIds = async (as: typeof context.alice) =>
    (
      (await call('GET /api/entries/feed', { as, query: { scope: 'community' }, status: 200 }))
        .body as { entries: { id: number }[] }
    ).entries.map((entry) => entry.id);
  const follows = async (as: typeof context.alice) =>
    (await call('GET /api/follows', { as, status: 200 })).body as {
      following: { id: number }[];
      followers: { id: number; username: string }[];
      followerCount: number;
    };
  let aliceEntry = 0;
  let bobEntry = 0;

  beforeAll(async () => {
    aliceEntry = await createEntry(context, context.alice, {
      text: 'Alice out loud',
      visibility: 'public',
    });
    bobEntry = await createEntry(context, context.bob, {
      text: 'Bob out loud',
      visibility: 'public',
    });
  });

  it('mutes a writer out of the feed while the follow stays, and lists them to undo', async () => {
    const { alice, bob } = context;
    await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    await call('PUT /api/writers/{userId}/mute', {
      as: bob,
      params: { userId: bob.id },
      status: 400,
      code: 'SOCIAL_CANNOT_MUTE_SELF',
    });
    await call('PUT /api/writers/{userId}/mute', {
      as: bob,
      params: { userId: 999_999 },
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    const muted = await call('PUT /api/writers/{userId}/mute', {
      as: bob,
      params: { userId: alice.id },
      status: 200,
    });
    expect(muted.body).toEqual({ userId: alice.id, muted: true });
    expect(await communityIds(bob)).not.toContain(aliceEntry);
    expect((await follows(bob)).following.map((user) => user.id)).toEqual([alice.id]);
    const hidden = await call('GET /api/writers/hidden', { as: bob, status: 200 });
    expect(hidden.body).toEqual({
      muted: [expect.objectContaining({ id: alice.id, username: alice.username })],
      blocked: [],
    });
    expect((await call('GET /api/writers/hidden', { as: alice, status: 200 })).body).toEqual({
      muted: [],
      blocked: [],
    });

    await call('DELETE /api/writers/{userId}/mute', {
      as: bob,
      params: { userId: alice.id },
      status: 200,
    });
    expect(await communityIds(bob)).toContain(aliceEntry);
  });

  it('lists followers to the one they follow, and removes one quietly', async () => {
    const { alice, bob } = context;
    const listed = await follows(alice);
    expect(listed.followers).toEqual([
      expect.objectContaining({ id: bob.id, username: bob.username }),
    ]);
    expect(listed.followerCount).toBe(1);

    const removed = await call('DELETE /api/follows/followers/{userId}', {
      as: alice,
      params: { userId: bob.id },
      status: 200,
    });
    expect(removed.body).toEqual({ userId: bob.id, following: false, requested: false });
    expect((await follows(alice)).followers).toEqual([]);
    expect((await follows(bob)).following).toEqual([]);
  });

  it('blocks both ways without telling the blocked writer, and unblocks', async () => {
    const { alice, bob } = context;
    await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    await call('PUT /api/writers/{userId}/block', {
      as: alice,
      params: { userId: alice.id },
      status: 400,
      code: 'SOCIAL_CANNOT_BLOCK_SELF',
    });
    const blocked = await call('PUT /api/writers/{userId}/block', {
      as: alice,
      params: { userId: bob.id },
      status: 200,
    });
    expect(blocked.body).toEqual({ userId: bob.id, blocked: true });
    expect((await follows(alice)).followers).toEqual([]);
    expect(await communityIds(alice)).not.toContain(bobEntry);
    expect(await communityIds(bob)).not.toContain(aliceEntry);
    await call('PUT /api/follows/{userId}', {
      as: bob,
      params: { userId: alice.id },
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    await call('POST /api/entries/{entryId}/comments', {
      as: bob,
      params: { entryId: aliceEntry },
      json: { content: 'Hello?' },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    expect((await call('GET /api/writers/hidden', { as: bob, status: 200 })).body).toEqual({
      muted: [],
      blocked: [],
    });

    await call('DELETE /api/writers/{userId}/block', {
      as: alice,
      params: { userId: bob.id },
      status: 200,
    });
    expect(await communityIds(bob)).toContain(aliceEntry);
    expect((await follows(bob)).following).toEqual([]);
  });
});

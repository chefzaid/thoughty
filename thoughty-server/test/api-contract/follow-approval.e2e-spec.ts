import { CONTRACT_PASSWORD, describeContract, registerWriter } from './contract-suite';
import { createEntry } from './contract-fixtures';

describeContract('follow-approval', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const SECRET = 'A thought only my approved followers read';
  let aliceEntry = 0;

  interface FeedEntry {
    id: number;
    title: string | null;
    content: string;
    tags: string[];
    timeOfDay: string | null;
    likeCount: number;
    commentCount: number;
    locked: boolean;
    author: { isFollowed: boolean; followRequested: boolean; approvalRequired: boolean };
  }
  const feedEntry = async (as: typeof context.alice, query: Record<string, string> = {}) => {
    const response = await call('GET /api/entries/feed', {
      as,
      query: { scope: 'community', ...query },
      status: 200,
    });
    const entry = (response.body as { entries: FeedEntry[] }).entries.find((candidate) => candidate.id === aliceEntry);
    // Left out or a teaser, nothing of its text reaches the reader
    if (!entry || entry.locked) expect(JSON.stringify(response.body)).not.toContain('only my approved');
    return entry;
  };
  const follows = async (as: typeof context.alice) =>
    (await call('GET /api/follows', { as, status: 200 })).body as {
      following: { id: number }[];
      requested: { id: number }[];
      followers: { id: number }[];
      requests: { id: number; username: string }[];
      followerCount: number;
      approvalRequired: boolean;
    };
  const notificationTypes = async (as: typeof context.alice) =>
    ((await call('GET /api/notifications', { as, status: 200 })).body as { notifications: { id: string }[] })
      .notifications.map((notification) => notification.id);

  beforeAll(async () => {
    aliceEntry = await createEntry(context, context.alice, {
      title: 'Letters to my sister',
      text: SECRET,
      tags: ['family'],
      visibility: 'public',
    });
  });

  it('is off by default, and keeps a follower already there approved when turned on', async () => {
    const { alice, bob } = context;
    expect((await follows(alice)).approvalRequired).toBe(false);
    const carol = await registerWriter(context.client, 'carol_follow_approval');
    await call('PUT /api/follows/{userId}', { as: carol, params: { userId: alice.id }, status: 200 });

    await call('PUT /api/follows/approval', { as: alice, json: { required: 'yes' }, status: 400, code: 'VALIDATION_FAILED' });
    const turnedOn = await call('PUT /api/follows/approval', { as: alice, json: { required: true }, status: 200 });
    expect(turnedOn.body).toEqual({ required: true, approved: 0 });
    expect(await follows(alice)).toEqual(
      expect.objectContaining({ approvalRequired: true, followerCount: 1, followers: [expect.objectContaining({ id: carol.id })] }),
    );
    expect(await feedEntry(carol)).toEqual(expect.objectContaining({ locked: false, content: SECRET }));
    expect((await feedEntry(bob))?.author.approvalRequired).toBe(true);
  });

  it('gives a writer not approved a teaser only, and refuses them its likes, saves and comments', async () => {
    const { bob } = context;
    expect(await feedEntry(bob)).toEqual(
      expect.objectContaining({
        locked: true,
        title: 'Letters to my sister',
        content: '',
        tags: [],
        timeOfDay: null,
        likeCount: 0,
        commentCount: 0,
        author: expect.objectContaining({ isFollowed: false, followRequested: false, approvalRequired: true }),
      }),
    );
    // A topic or a search would tell what the entry holds, so they do not list it
    await expect(feedEntry(bob, { tag: 'family' })).resolves.toBeUndefined();
    await expect(feedEntry(bob, { search: 'approved followers' })).resolves.toBeUndefined();
    for (const [operation, json] of [
      ['GET /api/entries/{entryId}/comments', undefined],
      ['POST /api/entries/{entryId}/comments', { content: 'Hello' }],
      ['PUT /api/entries/{entryId}/like', undefined],
      ['PUT /api/entries/{entryId}/save', undefined],
    ] as const) {
      await call(operation, { as: bob, params: { entryId: aliceEntry }, json, status: 403, code: 'FOLLOW_APPROVAL_REQUIRED' });
    }
  });

  it('turns a follow into a request the writer approves, after which the requester reads the entry', async () => {
    const { alice, bob } = context;
    const asked = await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    expect(asked.body).toEqual({ userId: alice.id, following: false, requested: true });
    expect((await feedEntry(bob))?.author).toEqual(expect.objectContaining({ followRequested: true, isFollowed: false }));
    expect(await follows(bob)).toEqual(
      expect.objectContaining({ following: [], requested: [expect.objectContaining({ id: alice.id })] }),
    );
    const listed = await follows(alice);
    expect(listed.requests).toEqual([expect.objectContaining({ id: bob.id, username: bob.username })]);
    expect(listed.followerCount).toBe(1);
    expect(await notificationTypes(alice)).toContain(`followRequest:${bob.id}`);
    expect((await feedEntry(bob))?.locked).toBe(true);

    await call('PUT /api/follows/followers/{userId}', {
      as: alice,
      params: { userId: 999_999 },
      status: 404,
      code: 'FOLLOW_REQUEST_NOT_FOUND',
    });
    const approved = await call('PUT /api/follows/followers/{userId}', {
      as: alice,
      params: { userId: bob.id },
      status: 200,
    });
    expect(approved.body).toEqual({ userId: bob.id, following: true, requested: false });
    expect(await feedEntry(bob)).toEqual(expect.objectContaining({ locked: false, content: SECRET, tags: ['family'] }));
    expect(await feedEntry(bob, { tag: 'family' })).toEqual(expect.objectContaining({ locked: false }));
    await call('PUT /api/entries/{entryId}/like', { as: bob, params: { entryId: aliceEntry }, status: 200 });
    await call('GET /api/entries/{entryId}/comments', { as: bob, params: { entryId: aliceEntry }, status: 200 });
    expect((await follows(alice)).followerCount).toBe(2);
    expect(await notificationTypes(alice)).toContain(`follow:${bob.id}`);
  });

  it('declines and withdraws requests without telling anyone', async () => {
    const { alice, bob } = context;
    await call('DELETE /api/follows/followers/{userId}', { as: alice, params: { userId: bob.id }, status: 200 });
    expect((await feedEntry(bob))?.locked).toBe(true);
    await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    const declined = await call('DELETE /api/follows/followers/{userId}', {
      as: alice,
      params: { userId: bob.id },
      status: 200,
    });
    expect(declined.body).toEqual({ userId: bob.id, following: false, requested: false });
    expect(await follows(bob)).toEqual(expect.objectContaining({ following: [], requested: [] }));
    // bob can take back the like he gave while approved
    await call('DELETE /api/entries/{entryId}/like', { as: bob, params: { entryId: aliceEntry }, status: 200 });

    await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    const withdrawn = await call('DELETE /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    expect(withdrawn.body).toEqual({ userId: alice.id, following: false, requested: false });
    expect((await follows(alice)).requests).toEqual([]);
  });

  it('approves every request still waiting when turned off, and lists them in the data download', async () => {
    const { alice, bob } = context;
    await call('PUT /api/follows/{userId}', { as: bob, params: { userId: alice.id }, status: 200 });
    const download = await call('GET /api/config/download-data', { as: bob, status: 200, contentType: /^application\/json/ });
    expect((download.body as { followRequests: { userId: number }[] }).followRequests).toEqual([
      expect.objectContaining({ userId: alice.id }),
    ]);

    const turnedOff = await call('PUT /api/follows/approval', { as: alice, json: { required: false }, status: 200 });
    expect(turnedOff.body).toEqual({ required: false, approved: 1 });
    expect(await follows(bob)).toEqual(expect.objectContaining({ following: [expect.objectContaining({ id: alice.id })], requested: [] }));
    expect(await feedEntry(bob)).toEqual(expect.objectContaining({ locked: false }));
    const own = await call('GET /api/config/download-data', { as: alice, status: 200, contentType: /^application\/json/ });
    expect((own.body as { user: { followersByApproval: boolean } }).user.followersByApproval).toBe(false);
  });

  it('lets a block end a request, and takes a deleted account\'s request away', async () => {
    const { alice } = context;
    await call('PUT /api/follows/approval', { as: alice, json: { required: true }, status: 200 });
    const dan = await registerWriter(context.client, 'dan_follow_approval');
    const erin = await registerWriter(context.client, 'erin_follow_approval');
    await call('PUT /api/follows/{userId}', { as: dan, params: { userId: alice.id }, status: 200 });
    await call('PUT /api/follows/{userId}', { as: erin, params: { userId: alice.id }, status: 200 });

    await call('PUT /api/writers/{userId}/block', { as: alice, params: { userId: dan.id }, status: 200 });
    expect((await follows(dan)).requested).toEqual([]);
    await call('POST /api/auth/delete-account', { as: erin, json: { password: CONTRACT_PASSWORD }, status: 200 });
    expect((await follows(alice)).requests).toEqual([]);
    expect(await notificationTypes(alice)).not.toContain(`followRequest:${erin.id}`);
  });
});

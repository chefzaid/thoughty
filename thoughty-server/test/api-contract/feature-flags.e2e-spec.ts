import { describeContract } from './contract-suite';
import { createEntry, todayIso } from './contract-fixtures';

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const disabled = { status: 503, code: 'FEATURE_DISABLED' } as const;

/**
 * Each runtime feature flag switched off, as an operator does with `FEATURE_FLAGS` or the flag provider:
 * the API reads it on the next request, refuses the feature's routes with 503 FEATURE_DISABLED, keeps
 * what was stored, and serves it all again once the flag is back on.
 */
describeContract('featureFlags', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const switchOff = (...flags: string[]) => {
    process.env.FEATURE_FLAGS = flags.map((flag) => `${flag}=false`).join(',');
  };

  afterEach(() => {
    delete process.env.FEATURE_FLAGS;
  });

  it('serves every flag, on by default, and a change on the next request', async () => {
    const { alice } = context;
    const on = await call('GET /api/config/feature-flags', { as: alice, status: 200 });
    expect(on.body).toEqual({ ai: true, bookConverter: true, cloudSync: true, publicSharing: true });
    switchOff('ai', 'cloudSync');
    const off = await call('GET /api/config/feature-flags', { as: alice, status: 200 });
    expect(off.body).toEqual({ ai: false, bookConverter: true, cloudSync: false, publicSharing: true });
  });

  it('refuses the AI routes while ai is off, keeps the key removable, and saves entries without AI', async () => {
    const { alice } = context;
    switchOff('ai');
    await call('POST /api/ai/fix-writing', { as: alice, json: { content: 'i has a dog', mode: 'grammar' }, ...disabled });
    await call('POST /api/stats/personality-analysis', { as: alice, json: {}, ...disabled });
    await call('POST /api/review/mood', { as: alice, json: { year: 2024 }, ...disabled });
    await call('GET /api/ai/credentials', { as: alice, status: 200 });
    await call('DELETE /api/ai/credentials', { as: alice, status: 200 });
    await call('POST /api/config', { as: alice, json: { autoTagMaxTags: 3 }, status: 200 });
    await createEntry(context, alice, { text: 'Saved while AI is off', tags: ['kept'] });
    // Without a session the answer is still 401, so a flag says nothing to a stranger
    await call('POST /api/ai/fix-writing', { json: { content: 'x', mode: 'grammar' }, status: 401, code: 'UNAUTHORIZED' });
  });

  it('refuses the book converter while bookConverter is off', async () => {
    const { alice } = context;
    switchOff('bookConverter');
    await call('GET /api/books/preview', { as: alice, query: { narrative: 'false' }, ...disabled });
    await call('GET /api/books/versions', { as: alice, ...disabled });
    delete process.env.FEATURE_FLAGS;
    await call('GET /api/books/versions', { as: alice, status: 200 });
  });

  it('refuses cloud sync while cloudSync is off, and still lets a writer disconnect', async () => {
    const { alice } = context;
    switchOff('cloudSync');
    await call('GET /api/cloud-sync/status', { as: alice, ...disabled });
    await call('POST /api/cloud-sync/sync', { as: alice, json: { provider: 'dropbox' }, ...disabled });
    await call('POST /api/cloud-sync/disconnect', { as: alice, json: { provider: 'dropbox' }, status: 200 });
  });

  it('shares nothing while publicSharing is off, changes nothing stored, and shares it all again once on', async () => {
    const { alice, bob } = context;
    const publicId = await createEntry(context, alice, { text: 'Already public before the switch', visibility: 'public' });
    const privateId = await createEntry(context, alice, { text: 'Kept to myself' });
    const created = await call('POST /api/share-links', {
      as: alice,
      json: { kind: 'entry', targetId: privateId, expiresAt: inDays(7) },
      status: 201,
    });
    const link = created.body as { id: number; token: string };

    switchOff('publicSharing');
    await call('GET /api/entries/feed', { as: bob, ...disabled });
    await call('GET /api/leaderboard', { as: bob, ...disabled });
    await call('GET /api/entries/{entryId}/comments', { as: bob, params: { entryId: publicId }, ...disabled });
    await call('GET /api/shared/{token}', { params: { token: link.token }, ...disabled });
    await call('POST /api/share-links', { as: alice, json: { kind: 'entry', targetId: privateId, expiresAt: inDays(7) }, ...disabled });
    // Nothing becomes public while it is off
    await call('POST /api/entries', {
      as: alice,
      json: { text: 'Would be public', tags: [], date: todayIso(), visibility: 'public', format: 'plain' },
      ...disabled,
    });
    await call('PATCH /api/entries/{id}/visibility', { as: alice, params: { id: privateId }, json: { visibility: 'public' }, ...disabled });
    await call('POST /api/entries/bulk', { as: alice, json: { ids: [privateId], action: 'visibility', visibility: 'public' }, ...disabled });
    const imported = await call('POST /api/io/import', {
      as: alice,
      json: { content: `---${todayIso()}--[]--[public]\nImported while sharing is off\n\n`, skipDuplicates: false, diaryId: null },
      status: 200,
    });
    expect(imported.body).toMatchObject({ importedCount: 1 });
    // An entry already public stays public through an edit, and the writer's own links stay listed
    const edited = await call('PUT /api/entries/{id}', {
      as: alice,
      params: { id: publicId },
      json: { text: 'Already public, edited', tags: [], date: todayIso(), visibility: 'public', format: 'plain' },
      status: 200,
    });
    expect(edited.body).toMatchObject({ entry: { visibility: 'public' } });
    const links = await call('GET /api/share-links', { as: alice, query: { kind: 'entry', targetId: String(privateId) }, status: 200 });
    expect(JSON.stringify(links.body)).toContain(`"id":${link.id}`);

    delete process.env.FEATURE_FLAGS;
    const feed = await call('GET /api/entries/feed', { as: bob, status: 200 });
    const shown = (feed.body as { entries: { id: number; content: string }[] }).entries.map((entry) => entry.content);
    expect(shown).toContain('Already public, edited');
    expect(shown).not.toContain('Imported while sharing is off');
    await call('GET /api/shared/{token}', { params: { token: link.token }, status: 200 });

    // Revoking always works, so a writer can take a link back while sharing is off
    switchOff('publicSharing');
    await call('DELETE /api/share-links/{id}', { as: alice, params: { id: link.id }, status: 200 });
    delete process.env.FEATURE_FLAGS;
    await call('GET /api/shared/{token}', { params: { token: link.token }, status: 404, code: 'SHARE_LINK_NOT_FOUND' });
  });
});

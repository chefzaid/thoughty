import { describeContract } from './contract-suite';
import { createEntry, defaultDiaryId } from './contract-fixtures';

describeContract('external', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  let entryId = 0;

  beforeAll(async () => {
    entryId = await createEntry(context, context.alice, {
      text: 'A day worth summarizing',
      tags: ['work'],
      date: '2024-06-01',
    });
  });

  it('reports the AI as unavailable and fails each AI action cleanly without a key', async () => {
    const { alice, bob } = context;
    const diaryId = await defaultDiaryId(context, alice);
    const noKey = { status: 400, code: 'AI_KEY_NOT_CONFIGURED' } as const;
    await call('GET /api/ai/models', { as: alice, ...noKey });
    const credential = await call('GET /api/ai/credentials', { as: alice, status: 200 });
    expect(credential.body).toMatchObject({
      aiAvailable: false,
      hasPersonalKey: false,
      source: 'none',
    });
    await call('GET /api/ai/usage', { as: alice, status: 400, code: 'AI_PERSONAL_KEY_REQUIRED' });
    await call('POST /api/ai/suggest-tags', {
      as: alice,
      json: { content: 'Walked by the sea', existingTags: [], maxTags: 3 },
      ...noKey,
    });
    await call('POST /api/ai/fix-writing', {
      as: alice,
      json: { content: 'i has a dog', mode: 'grammar' },
      ...noKey,
    });
    await call('POST /api/ai/summarize', { as: alice, json: { entryId }, ...noKey });
    await call('POST /api/ai/summarize', {
      as: bob,
      json: { entryId },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    await call('POST /api/ai/inspiration', { as: alice, json: { diaryId }, ...noKey });
    // One entry has nothing to be a duplicate of, so the scan answers without asking the AI
    const scan = await call('POST /api/ai/duplicates', { as: alice, json: {}, status: 200 });
    expect(scan.body).toMatchObject({ analyzedEntries: 1, groups: [] });
    await call('POST /api/ai/semantic-search', {
      as: alice,
      json: { query: 'the sea', diaryId: null },
      ...noKey,
    });
    await call('POST /api/ai/journal-retag/preview', { as: alice, ...noKey });
    // Applying tags the writer reviewed needs no AI
    const applied = await call('POST /api/ai/journal-retag/apply', {
      as: alice,
      json: { mode: 'add', assignments: [{ entryId, tags: ['review'] }] },
      status: 201,
    });
    expect(applied.body).toMatchObject({ affectedEntries: 1 });
    await call('POST /api/ai/journal-retag/apply', {
      as: bob,
      json: { mode: 'add', assignments: [{ entryId, tags: ['mine'] }] },
      status: 400,
      code: 'ENTRIES_NOT_FOUND',
    });
    const tagged = await call('GET /api/entries/tags', { as: alice, status: 200 });
    expect(JSON.stringify(tagged.body)).toContain('review');
    expect(JSON.stringify(tagged.body)).not.toContain('mine');
    await call('POST /api/ai/chat', {
      as: alice,
      json: {
        entryId,
        entryContent: 'A day worth summarizing',
        messages: [{ role: 'user', content: 'Why?' }],
      },
      ...noKey,
    });
    const history = await call('GET /api/ai/history/{entryId}', {
      as: alice,
      params: { entryId },
      status: 200,
    });
    expect(history.body).toMatchObject({ messages: [] });
    await call('GET /api/ai/history/{entryId}', {
      as: bob,
      params: { entryId },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    // Without a key the analysis is simply left out
    const personality = await call('POST /api/stats/personality-analysis', {
      as: alice,
      json: { diaryId, fromDate: '2024-01-01', toDate: '2024-12-31' },
      status: 201,
    });
    expect(personality.body).toEqual({ analysis: null });
    await call('POST /api/stats/personality-analysis', {
      as: alice,
      json: { fromDate: '2024-12-31', toDate: '2024-01-01' },
      status: 400,
      code: 'STATS_INVALID_DATE_RANGE',
    });
    await call('POST /api/review/mood', {
      as: alice,
      json: { year: 2024, diaryId },
      status: 503,
      code: 'REVIEW_MOOD_UNAVAILABLE',
    });
    await call('POST /api/review/mood', {
      as: bob,
      json: { year: 2024, diaryId },
      status: 404,
      code: 'DIARY_NOT_FOUND',
    });
    // Without a key nothing was sent to OpenRouter
    expect(context.api.blockedRequests).toEqual([]);
  });

  it('checks a personal OpenRouter key with OpenRouter before keeping it, and removes it', async () => {
    const { alice } = context;
    // Outbound calls are blocked, so OpenRouter is unreachable
    await call('PUT /api/ai/credentials', {
      as: alice,
      json: { apiKey: 'sk-or-v1-contract-test-key-0001' },
      status: 502,
      code: 'AI_PROVIDER_FAILED',
    });
    expect(
      context.api.blockedRequests.some((url) => url.startsWith('https://openrouter.ai/')),
    ).toBe(true);
    await call('PUT /api/ai/credentials', {
      as: alice,
      json: { apiKey: '' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    const removed = await call('DELETE /api/ai/credentials', { as: alice, status: 200 });
    expect(removed.body).toMatchObject({ hasPersonalKey: false, source: 'none' });
  });

  it('lists no cloud connection and refuses every cloud action until one is made', async () => {
    const { alice } = context;
    const status = await call('GET /api/cloud-sync/status', { as: alice, status: 200 });
    expect(JSON.stringify(status.body)).not.toContain('"connected":true');
    const redirectUri = 'http://localhost:5173/cloud/callback';
    // No OAuth client is configured, so no sign-in link is handed out
    const notConfigured = { status: 503, code: 'CLOUD_PROVIDER_NOT_CONFIGURED' } as const;
    for (const provider of ['google_drive', 'onedrive', 'dropbox']) {
      await call('POST /api/cloud-sync/auth-url', {
        as: alice,
        json: { provider, redirectUri },
        ...notConfigured,
      });
    }
    await call('POST /api/cloud-sync/connect', {
      as: alice,
      json: { provider: 'dropbox', code: 'abc', redirectUri },
      ...notConfigured,
    });
    await call('POST /api/cloud-sync/auth-url', {
      as: alice,
      json: { provider: 'icloud', redirectUri },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    const notConnected = { status: 400, code: 'CLOUD_NOT_CONNECTED' } as const;
    await call('GET /api/cloud-sync/files', {
      as: alice,
      query: { provider: 'google_drive' },
      ...notConnected,
    });
    await call('POST /api/cloud-sync/upload', {
      as: alice,
      json: { provider: 'onedrive', format: 'json', includeVisibility: false, diaryId: null },
      ...notConnected,
    });
    await call('POST /api/cloud-sync/download', {
      as: alice,
      json: { provider: 'onedrive', fileId: 'file-1' },
      ...notConnected,
    });
    await call('POST /api/cloud-sync/schedule', {
      as: alice,
      json: {
        provider: 'dropbox',
        frequency: 'daily',
        format: 'md',
        diaryId: null,
        includeVisibility: true,
      },
      ...notConnected,
    });
    await call('POST /api/cloud-sync/sync', {
      as: alice,
      json: { provider: 'dropbox' },
      ...notConnected,
    });
    const schedules = await call('GET /api/cloud-sync/schedules', { as: alice, status: 200 });
    expect(schedules.body).toMatchObject({ dropbox: { enabled: false } });
    await call('DELETE /api/cloud-sync/schedule', {
      as: alice,
      query: { provider: 'dropbox' },
      status: 200,
    });
    await call('POST /api/cloud-sync/disconnect', {
      as: alice,
      json: { provider: 'dropbox' },
      status: 200,
    });
  });
});

import { describeContract } from './contract-suite';
import { createEntry, defaultDiaryId, todayIso } from './contract-fixtures';

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
    // The entries are found before the AI is asked, so another writer's filters match nothing
    await call('POST /api/entries/chat', {
      as: alice,
      query: { tags: 'work', dateFrom: '2024-01-01', dateTo: '2024-12-31' },
      json: { messages: [{ role: 'user', content: 'What comes back?' }] },
      ...noKey,
    });
    await call('POST /api/entries/chat', {
      as: bob,
      query: { tags: 'work' },
      json: { messages: [{ role: 'user', content: 'What comes back?' }] },
      status: 404,
      code: 'ENTRY_CHAT_NO_MATCH',
    });
    await call('POST /api/entries/chat', { as: alice, json: { messages: [] }, status: 400, code: 'VALIDATION_FAILED' });
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
    await call('POST /api/review/week', {
      as: alice,
      json: { today: '2024-06-01', diaryId },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('POST /api/review/week', { as: bob, json: { today: todayIso() }, status: 400, code: 'REVIEW_WEEK_EMPTY' });
    await createEntry(context, alice, { text: 'A week worth reflecting on' });
    await call('POST /api/review/week', {
      as: alice,
      json: { today: todayIso(), diaryId },
      status: 503,
      code: 'REVIEW_REFLECTION_UNAVAILABLE',
    });
    await call('POST /api/review/week', {
      as: bob,
      json: { today: todayIso(), diaryId },
      status: 404,
      code: 'DIARY_NOT_FOUND',
    });
    // Interview mode asks about a known question of a started memoir before the AI is asked
    const followUp = { questionId: 'childhood-home', text: 'A narrow house with a fig tree.' };
    await call('POST /api/memoir/follow-ups', { as: bob, json: followUp, status: 404, code: 'MEMOIR_NOT_STARTED' });
    await call('POST /api/memoir', {
      as: bob,
      json: { diaryName: 'My memoir', emailEnabled: false, deliveryWeekday: 1, timeZone: 'Europe/Paris' },
      status: 201,
    });
    await call('POST /api/memoir/follow-ups', { as: bob, json: { ...followUp, questionId: 'moon-landing' }, status: 404, code: 'MEMOIR_UNKNOWN_QUESTION' });
    await call('POST /api/memoir/follow-ups', { as: bob, json: { ...followUp, text: '   ' }, status: 400, code: 'VALIDATION_FAILED' });
    await call('POST /api/memoir/follow-ups', { as: bob, json: { ...followUp, asked: ['What did the fig tree smell like?'] }, ...noKey });
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

  it('keeps the Contact form closed without a mail server', async () => {
    await call('POST /api/contact', {
      json: { name: 'Visitor', email: 'visitor@example.com', message: 'Is anyone reading this?', website: '' },
      status: 503,
      code: 'CONTACT_NOT_CONFIGURED',
    });
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
        timeZone: 'Europe/Paris',
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

  it('keeps the writer’s time zone with a sync schedule, for the day that names its files', async () => {
    const { alice, bob } = context;
    // A connection as the OAuth flow leaves it, which no outside drive can make here: the stored tokens
    await context.api.dataSource.query(
      `INSERT INTO settings (user_id, key, value) VALUES ($1, 'cloud_onedrive_access_token', 'iv:tag:token'),
        ($1, 'cloud_onedrive_refresh_token', 'iv:tag:token')`,
      [alice.id],
    );
    const schedule = { provider: 'onedrive', frequency: 'daily', format: 'txt', includeVisibility: false };
    for (const timeZone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      await call('POST /api/cloud-sync/schedule', { as: alice, json: { ...schedule, timeZone }, status: 200 });
      const saved = await call('GET /api/cloud-sync/schedules', { as: alice, status: 200 });
      expect(saved.body).toMatchObject({ onedrive: { enabled: true, frequency: 'daily', timeZone } });
    }
    for (const json of [schedule, { ...schedule, timeZone: 'Mars/Olympus_Mons' }, { ...schedule, timeZone: 'x'.repeat(65) }]) {
      await call('POST /api/cloud-sync/schedule', { as: alice, json, status: 400, code: 'VALIDATION_FAILED' });
    }
    const kept = await call('GET /api/cloud-sync/schedules', { as: alice, status: 200 });
    expect(kept.body).toMatchObject({ onedrive: { timeZone: 'Pacific/Pago_Pago' } });
    const others = await call('GET /api/cloud-sync/schedules', { as: bob, status: 200 });
    expect((others.body as { onedrive: { timeZone?: string } }).onedrive.timeZone).toBeUndefined();
    await call('DELETE /api/cloud-sync/schedule', { as: alice, query: { provider: 'onedrive' }, status: 200 });
    const removed = await call('GET /api/cloud-sync/schedules', { as: alice, status: 200 });
    expect(removed.body).toMatchObject({ onedrive: { enabled: false } });
    expect((removed.body as { onedrive: { timeZone?: string } }).onedrive.timeZone).toBeUndefined();
  });

  it('keeps every AI feature away from a diary with AI off, until it is turned back on', async () => {
    const { alice } = context;
    const form = { name: 'Health', icon: '🩺', visibility: 'private' };
    const created = await call('POST /api/diaries', { as: alice, json: { ...form, aiMode: 'off' }, status: 201 });
    const diary = created.body as { id: number; aiMode: string };
    expect(diary.aiMode).toBe('off');
    // Left out, the mode is kept; a mode it does not know, or none, is refused
    const kept = await call('PUT /api/diaries/{id}', { as: alice, params: { id: diary.id }, json: form, status: 200 });
    expect(kept.body).toMatchObject({ aiMode: 'off' });
    for (const aiMode of ['cloud', null]) {
      await call('PUT /api/diaries/{id}', { as: alice, params: { id: diary.id }, json: { ...form, aiMode }, status: 400, code: 'VALIDATION_FAILED' });
    }

    const privateId = await createEntry(context, alice, { text: 'A visit to the clinic', tags: ['health'], diaryId: diary.id });
    const aiOff = { status: 403, code: 'DIARY_AI_OFF' } as const;
    await call('POST /api/ai/summarize', { as: alice, json: { entryId: privateId }, ...aiOff });
    const messages = [{ role: 'user', content: 'Why?' }];
    await call('POST /api/ai/chat', { as: alice, json: { entryId: privateId, entryContent: 'A visit', messages }, ...aiOff });
    // Text sent from that diary is refused too; a diary that is not the writer's is not found
    const rephrase = { content: 'A visit to the clinic', mode: 'grammar', diaryId: diary.id };
    const autoTag = { content: 'A visit to the clinic', diaryId: diary.id };
    await call('POST /api/ai/fix-writing', { as: alice, json: rephrase, ...aiOff });
    await call('POST /api/ai/suggest-tags', { as: alice, json: autoTag, ...aiOff });
    const bobDiaryId = await defaultDiaryId(context, context.bob);
    const notFound = { status: 404, code: 'DIARY_NOT_FOUND' } as const;
    await call('POST /api/ai/fix-writing', { as: alice, json: { ...rephrase, diaryId: bobDiaryId }, ...notFound });
    await call('POST /api/ai/suggest-tags', { as: alice, json: { ...autoTag, diaryId: 0 }, status: 400, code: 'VALIDATION_FAILED' });
    // A recording no entry holds yet (a memoir answer being written) names the diary it is for
    const recording = await call('POST /api/attachments/upload', {
      as: alice,
      multipart: { files: [{ field: 'file', buffer: Buffer.from('ID3'), filename: 'memory.mp3', contentType: 'audio/mpeg' }] },
      status: 201,
    });
    const transcribe = { as: alice, params: { id: (recording.body as { id: number }).id } };
    await call('POST /api/attachments/{id}/transcribe', { ...transcribe, json: { diaryId: diary.id }, ...aiOff });
    await call('POST /api/attachments/{id}/transcribe', { ...transcribe, json: { diaryId: bobDiaryId }, ...notFound });
    // Whole-journal features never read it: retagging cannot reach it, and the duplicate scan leaves it out
    const retag = { mode: 'add', assignments: [{ entryId: privateId, tags: ['ai'] }] };
    await call('POST /api/ai/journal-retag/apply', { as: alice, json: retag, status: 400, code: 'ENTRIES_NOT_FOUND' });
    const scan = await call('POST /api/ai/duplicates', { as: alice, json: { diaryId: diary.id }, status: 200 });
    expect(scan.body).toMatchObject({ analyzedEntries: 0, totalEntries: 0 });

    await call('PUT /api/diaries/{id}', { as: alice, params: { id: diary.id }, json: { ...form, aiMode: 'on' }, status: 200 });
    await call('POST /api/ai/summarize', { as: alice, json: { entryId: privateId }, status: 400, code: 'AI_KEY_NOT_CONFIGURED' });
    await call('POST /api/ai/fix-writing', { as: alice, json: rephrase, status: 400, code: 'AI_KEY_NOT_CONFIGURED' });
    await call('POST /api/ai/suggest-tags', { as: alice, json: autoTag, status: 400, code: 'AI_KEY_NOT_CONFIGURED' });
    await call('POST /api/attachments/{id}/transcribe', { ...transcribe, json: { diaryId: diary.id }, status: 400, code: 'AI_KEY_NOT_CONFIGURED' });
    await call('DELETE /api/diaries/{id}', { as: alice, params: { id: diary.id }, status: 200 });
  });

  it('sends nothing from a diary that asks each time without the writer’s consent, and leaves it out of the whole journal', async () => {
    const { alice } = context;
    const created = await call('POST /api/diaries', { as: alice, json: { name: 'Dreams', icon: '🌙', visibility: 'private', aiMode: 'ask' }, status: 201 });
    const diary = created.body as { id: number; aiMode: string };
    expect(diary.aiMode).toBe('ask');

    const entryId = await createEntry(context, alice, { text: 'A dream about the sea', tags: ['dreams'], diaryId: diary.id });
    const unasked = { status: 403, code: 'DIARY_AI_CONSENT_REQUIRED' } as const;
    // With consent the request passes the diary's check and goes on to the provider, which this writer has no key for
    const agreed = { status: 400, code: 'AI_KEY_NOT_CONFIGURED' } as const;
    const messages = [{ role: 'user', content: 'Why?' }];
    const requests = [
      ['POST /api/ai/summarize', { entryId }],
      ['POST /api/ai/chat', { entryId, entryContent: 'A dream', messages }],
      ['POST /api/ai/fix-writing', { content: 'A dream about the sea', mode: 'grammar', diaryId: diary.id }],
      ['POST /api/ai/suggest-tags', { content: 'A dream about the sea', diaryId: diary.id }],
    ] as const;
    for (const [operation, json] of requests) {
      await call(operation, { as: alice, json, ...unasked });
      await call(operation, { as: alice, json: { ...json, aiConsent: false }, ...unasked });
      await call(operation, { as: alice, json: { ...json, aiConsent: true }, ...agreed });
    }
    await call('POST /api/ai/summarize', { as: alice, json: { entryId, aiConsent: 'yes' }, status: 400, code: 'VALIDATION_FAILED' });

    const recording = await call('POST /api/attachments/upload', {
      as: alice,
      multipart: { files: [{ field: 'file', buffer: Buffer.from('ID3'), filename: 'dream.mp3', contentType: 'audio/mpeg' }] },
      status: 201,
    });
    const transcribe = { as: alice, params: { id: (recording.body as { id: number }).id } };
    await call('POST /api/attachments/{id}/transcribe', { ...transcribe, json: { diaryId: diary.id }, ...unasked });
    await call('POST /api/attachments/{id}/transcribe', { ...transcribe, json: { diaryId: diary.id, aiConsent: true }, ...agreed });

    // No single text to show: the whole-journal features leave it out, as they do a diary with AI off
    const scan = await call('POST /api/ai/duplicates', { as: alice, json: { diaryId: diary.id }, status: 200 });
    expect(scan.body).toMatchObject({ analyzedEntries: 0, totalEntries: 0 });
    const retag = { mode: 'add', assignments: [{ entryId, tags: ['ai'] }] };
    await call('POST /api/ai/journal-retag/apply', { as: alice, json: retag, status: 400, code: 'ENTRIES_NOT_FOUND' });
    await call('DELETE /api/diaries/{id}', { as: alice, params: { id: diary.id }, status: 200 });
  });

  it('never sends a diary on the writer’s own model to Thoughty’s provider, and leaves it out of the whole journal', async () => {
    const { alice } = context;
    const created = await call('POST /api/diaries', { as: alice, json: { name: 'Letters', icon: '✉️', visibility: 'private', aiMode: 'local' }, status: 201 });
    const diary = created.body as { id: number; aiMode: string };
    expect(diary.aiMode).toBe('local');

    const entryId = await createEntry(context, alice, { text: 'A letter to my sister', tags: ['family'], diaryId: diary.id });
    // Consent changes nothing: the browser sends its text to the writer's own model, never through this server
    const local = { status: 403, code: 'DIARY_AI_LOCAL' } as const;
    const messages = [{ role: 'user', content: 'Why?' }];
    const requests = [
      ['POST /api/ai/summarize', { entryId }],
      ['POST /api/ai/chat', { entryId, entryContent: 'A letter', messages }],
      ['POST /api/ai/fix-writing', { content: 'A letter to my sister', mode: 'grammar', diaryId: diary.id }],
      ['POST /api/ai/suggest-tags', { content: 'A letter to my sister', diaryId: diary.id }],
    ] as const;
    for (const [operation, json] of requests) {
      await call(operation, { as: alice, json, ...local });
      await call(operation, { as: alice, json: { ...json, aiConsent: true }, ...local });
    }
    const recording = await call('POST /api/attachments/upload', {
      as: alice,
      multipart: { files: [{ field: 'file', buffer: Buffer.from('ID3'), filename: 'letter.mp3', contentType: 'audio/mpeg' }] },
      status: 201,
    });
    const transcribe = { as: alice, params: { id: (recording.body as { id: number }).id } };
    await call('POST /api/attachments/{id}/transcribe', { ...transcribe, json: { diaryId: diary.id, aiConsent: true }, ...local });

    const scan = await call('POST /api/ai/duplicates', { as: alice, json: { diaryId: diary.id }, status: 200 });
    expect(scan.body).toMatchObject({ analyzedEntries: 0, totalEntries: 0 });
    const retag = { mode: 'add', assignments: [{ entryId, tags: ['ai'] }] };
    await call('POST /api/ai/journal-retag/apply', { as: alice, json: retag, status: 400, code: 'ENTRIES_NOT_FOUND' });

    // Back on, the same requests reach the provider, which this writer has no key for
    await call('PUT /api/diaries/{id}', { as: alice, params: { id: diary.id }, json: { name: 'Letters', icon: '✉️', visibility: 'private', aiMode: 'on' }, status: 200 });
    await call('POST /api/ai/summarize', { as: alice, json: { entryId }, status: 400, code: 'AI_KEY_NOT_CONFIGURED' });
    await call('DELETE /api/diaries/{id}', { as: alice, params: { id: diary.id }, status: 200 });
  });
});

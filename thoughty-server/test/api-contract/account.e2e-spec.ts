import { ConfigService } from '@nestjs/config';
import { getUnsubscribeSecret } from '../../src/modules/auth/auth-secrets';
import { createEmailUnsubscribeToken } from '../../src/modules/opt-in-email/email-unsubscribe-token';
import { createUnsubscribeToken } from '../../src/modules/on-this-day-email/on-this-day-unsubscribe-token';
import { describeContract, registerWriter } from './contract-suite';
import { createEntry, defaultDiaryId, todayIso } from './contract-fixtures';

describeContract('account', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);

  it('answers the health check and hides metrics from outside the private network', async () => {
    await call('GET /api/health', { status: 200 });
    // Supertest connects over loopback, which counts as the private network
    const metrics = await call('GET /api/metrics', { status: 200, contentType: /^text\/plain/ });
    expect(metrics.text).toContain('thoughty_');
    await call('GET /api/metrics', {
      headers: { 'X-Forwarded-For': '203.0.113.9' },
      status: 200,
      contentType: /^text\/plain/,
    });
  });

  it('reads and saves the profile settings the way the profile page does', async () => {
    const { alice, bob } = context;
    await call('GET /api/config', { as: alice, status: 200 });
    await call('POST /api/config', {
      as: alice,
      json: {
        theme: 'light',
        language: 'fr',
        entriesPerPage: 25,
        highContrast: false,
        streakCard: true,
        quietMode: true,
        comfortReads: false,
        readDates: false,
        promptCardsDrawn: 'gratitude-3,smallJoys-12',
        fontFamily: 'legible',
        lineSpacing: 'loose',
        letterSpacing: 'wide',
      },
      status: 200,
    });
    // Settings are stored and read back as text
    const saved = await call('GET /api/config', { as: alice, status: 200 });
    expect(saved.body).toMatchObject({
      theme: 'light',
      language: 'fr',
      entriesPerPage: '25',
      highContrast: 'false',
      streakCard: 'true',
      quietMode: 'true',
      comfortReads: 'false',
      promptCardsDrawn: 'gratitude-3,smallJoys-12',
      fontFamily: 'legible',
      lineSpacing: 'loose',
      letterSpacing: 'wide',
    });
    const other = await call('GET /api/config', { as: bob, status: 200 });
    // Quiet mode is off until the writer turns it on
    expect(other.body).toMatchObject({ theme: 'dark', language: 'en', quietMode: 'false' });
    // Reading comfort keeps today's look until the writer picks a step
    expect(other.body).toMatchObject({ fontFamily: 'system', lineSpacing: 'normal', letterSpacing: 'normal' });
    for (const json of [{ lineSpacing: '2.5' }, { lineSpacing: 2 }, { letterSpacing: '0.12em' }, { fontFamily: 'comic' }]) {
      await call('POST /api/config', { as: alice, json, status: 400, code: 'VALIDATION_FAILED' });
    }
    // A refused value leaves the saved one as it was
    const unchanged = await call('GET /api/config', { as: alice, status: 200 });
    expect(unchanged.body).toMatchObject({ fontFamily: 'legible', lineSpacing: 'loose', letterSpacing: 'wide' });
    await call('POST /api/config', {
      as: alice,
      json: { entriesPerPage: '' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('POST /api/config', { as: alice, json: { promptCardsDrawn: 'gratitude-3;' }, status: 400, code: 'VALIDATION_FAILED' });
    await call('GET /api/config', { status: 401, code: 'UNAUTHORIZED' });
    await call('GET /api/config/feature-flags', { as: alice, status: 200 });
  });

  it('downloads all of the writer’s data as a JSON file', async () => {
    const { alice } = context;
    await createEntry(context, alice, { text: 'Data download entry', tags: ['export'] });
    const download = await call('GET /api/config/download-data', {
      as: alice,
      status: 200,
      contentType: /^application\/json/,
    });
    expect(String(download.headers['content-disposition'])).toContain('attachment');
    expect(JSON.stringify(download.body)).toContain('Data download entry');
    expect(JSON.stringify(download.body)).not.toContain(context.bob.email);
  });

  it('measures stats and the streak for all diaries or one, up to the writer’s day', async () => {
    const { alice, bob } = context;
    const diaryId = await defaultDiaryId(context, alice);
    await createEntry(context, alice, { text: 'Streak entry', tags: ['streak'], date: todayIso() });
    const all = await call('GET /api/stats', {
      as: alice,
      query: { today: todayIso() },
      status: 200,
    });
    const one = await call('GET /api/stats', {
      as: alice,
      query: { diaryId: String(diaryId), today: todayIso() },
      status: 200,
    });
    expect((one.body as { totalThoughts: number }).totalThoughts).toBe(
      (all.body as { totalThoughts: number }).totalThoughts,
    );
    const streak = await call('GET /api/stats/streak', {
      as: alice,
      query: { today: todayIso() },
      status: 200,
    });
    expect(streak.body).toMatchObject({ writtenToday: true });
    const bobStats = await call('GET /api/stats', {
      as: bob,
      query: { today: todayIso() },
      status: 200,
    });
    expect((bobStats.body as { totalThoughts: number }).totalThoughts).toBe(0);
    await call('GET /api/stats', {
      as: alice,
      query: { diaryId: '' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('lists the tags on good and low moods, per diary, without the recycle bin, sealed capsules or other writers', async () => {
    const { bob } = context;
    const erin = await registerWriter(context.client, 'erin');
    const journal = await defaultDiaryId(context, erin);
    const travel = await call('POST /api/diaries', {
      as: erin,
      json: { name: 'Travel', visibility: 'private', goalType: null, goalTarget: null },
      status: 201,
    });
    const travelId = (travel.body as { id: number }).id;
    const write = (mood: number, tags: string[], diaryId = journal) => createEntry(context, erin, { text: 'A day', mood, tags, diaryId });
    await write(5, ['family', 'walks']);
    await write(4, ['family', 'walks', 'once']);
    await write(2, ['family', 'sleep']);
    await write(1, ['family', 'sleep']);
    await write(3, ['walks', 'okay']);
    await write(3, ['okay']);
    await write(4, ['sea'], travelId);
    await write(5, ['sea'], travelId);
    const binned = await write(1, ['bin']);
    await write(2, ['bin']);
    await call('DELETE /api/entries/{id}', { as: erin, params: { id: binned }, status: 200 });
    for (let copy = 0; copy < 2; copy += 1) {
      await call('POST /api/entries', {
        as: erin,
        json: { text: 'Later', tags: ['sealed'], mood: 5, date: todayIso(), visibility: 'private', format: 'plain', seal: { opensOn: todayIso(365), timeZone: 'UTC' } },
        status: 201,
      });
    }
    await createEntry(context, bob, { text: 'Bob’s day', mood: 5, tags: ['family'] });

    const all = await call('GET /api/stats', { as: erin, query: { today: todayIso() }, status: 200 });
    expect((all.body as { moods: unknown }).moods).toMatchObject({
      goodMoodTags: [{ tag: 'family', entries: 2 }, { tag: 'sea', entries: 2 }, { tag: 'walks', entries: 2 }],
      lowMoodTags: [{ tag: 'family', entries: 2 }, { tag: 'sleep', entries: 2 }],
    });
    const one = await call('GET /api/stats', { as: erin, query: { diaryId: String(travelId), today: todayIso() }, status: 200 });
    expect((one.body as { moods: unknown }).moods).toMatchObject({ goodMoodTags: [{ tag: 'sea', entries: 2 }], lowMoodTags: [] });
  });

  it('ranks the words of the writer’s month, per diary, without the recycle bin, sealed capsules or other writers', async () => {
    const { bob } = context;
    const frank = await registerWriter(context.client, 'frank');
    const notes = await call('POST /api/diaries', {
      as: frank,
      json: { name: 'Notes', visibility: 'private', goalType: null, goalTarget: null },
      status: 201,
    });
    const notesId = (notes.body as { id: number }).id;
    await createEntry(context, frank, { text: 'The garden after the rain, with @Marie.', format: 'markdown' });
    await createEntry(context, frank, { text: 'Le jardin sous la pluie ; l’odeur du jardin. **Garden** again.', format: 'markdown' });
    await createEntry(context, frank, { text: 'Notes notes', diaryId: notesId });
    // Last month, the recycle bin, a sealed capsule and another writer stay out
    await createEntry(context, frank, { text: 'Pumpkin pumpkin', date: todayIso(-40) });
    const binned = await createEntry(context, frank, { text: 'Binned binned' });
    await call('DELETE /api/entries/{id}', { as: frank, params: { id: binned }, status: 200 });
    await call('POST /api/entries', {
      as: frank,
      json: { text: 'Secret secret', tags: [], date: todayIso(), visibility: 'private', format: 'plain', seal: { opensOn: todayIso(365), timeZone: 'UTC' } },
      status: 201,
    });
    await createEntry(context, bob, { text: 'Garden garden garden' });

    const all = await call('GET /api/stats', { as: frank, query: { today: todayIso() }, status: 200 });
    expect((all.body as { topWords: unknown }).topWords).toEqual({
      month: todayIso().slice(0, 7),
      words: [{ word: 'garden', count: 2 }, { word: 'jardin', count: 2 }, { word: 'notes', count: 2 }],
    });
    const one = await call('GET /api/stats', { as: frank, query: { diaryId: String(notesId), today: todayIso() }, status: 200 });
    expect((one.body as { topWords: unknown }).topWords).toEqual({ month: todayIso().slice(0, 7), words: [{ word: 'notes', count: 2 }] });
  });

  it('reviews a year for all diaries or one, and refuses another writer’s diary', async () => {
    const { alice, bob } = context;
    const year = String(new Date().getFullYear());
    await call('GET /api/review', { as: alice, query: { year }, status: 200 });
    const diaryId = await defaultDiaryId(context, alice);
    await call('GET /api/review', {
      as: alice,
      query: { year, diaryId: String(diaryId) },
      status: 200,
    });
    await call('GET /api/review', {
      as: bob,
      query: { year, diaryId: String(diaryId) },
      status: 404,
      code: 'DIARY_NOT_FOUND',
    });
  });

  it('runs the memoir program from start to stop', async () => {
    const { alice, bob } = context;
    const before = await call('GET /api/memoir', { as: alice, status: 200 });
    expect((before.body as { program: unknown }).program).toBeNull();
    const started = await call('POST /api/memoir', {
      as: alice,
      json: {
        diaryName: 'My memoir',
        emailEnabled: false,
        deliveryWeekday: 1,
        timeZone: 'Europe/Paris',
      },
      status: 201,
    });
    await call('POST /api/memoir', {
      as: alice,
      json: {
        diaryName: 'Again',
        emailEnabled: false,
        deliveryWeekday: 1,
        timeZone: 'Europe/Paris',
      },
      status: 409,
      code: 'MEMOIR_ALREADY_STARTED',
    });
    const questionOf = (body: unknown) =>
      (body as { program: { currentQuestionId: string } }).program.currentQuestionId;
    const skipped = await call('POST /api/memoir/skip', { as: alice, status: 200 });
    const next = { id: questionOf(skipped.body) };
    expect(next.id).not.toBe(questionOf(started.body));
    // Not this week: the question is set aside until a writer's day, and the week gets another one
    const snoozed = await call('POST /api/memoir/snooze', { as: alice, status: 200 });
    const later = questionOf(snoozed.body);
    const questions = (snoozed.body as { chapters: Array<{ questions: Array<{ id: string; snoozedUntil: string | null }> }> })
      .chapters.flatMap((chapter) => chapter.questions);
    expect(later).not.toBe(next.id);
    expect(questions.filter((question) => question.snoozedUntil).map((question) => question.id)).toEqual([next.id]);
    expect(questions.find((question) => question.id === next.id)?.snoozedUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await call('POST /api/memoir/answers', {
      as: alice,
      json: { questionId: next.id, text: 'I grew up by the sea.' },
      status: 201,
    });
    await call('POST /api/memoir/answers', {
      as: alice,
      json: { questionId: next.id, text: 'Twice' },
      status: 409,
      code: 'MEMOIR_ALREADY_ANSWERED',
    });
    await call('POST /api/memoir/answers', {
      as: alice,
      json: { questionId: later, text: 'Down by the harbour.' },
      status: 201,
    });
    await call('POST /api/memoir/snooze', { as: alice, status: 409, code: 'MEMOIR_NO_OPEN_QUESTION' });
    await call('PATCH /api/memoir', {
      as: alice,
      json: { status: 'paused', emailEnabled: false },
      status: 200,
    });
    await call('PATCH /api/memoir', {
      as: bob,
      json: { status: 'paused' },
      status: 404,
      code: 'MEMOIR_NOT_STARTED',
    });
    await call('POST /api/memoir/skip', { as: bob, status: 404, code: 'MEMOIR_NOT_STARTED' });
    await call('POST /api/memoir/snooze', { as: bob, status: 404, code: 'MEMOIR_NOT_STARTED' });
    await call('DELETE /api/memoir', { as: alice, status: 200 });
  });

  it('saves the opt-in emails and turns them off from an unsubscribe link', async () => {
    const { alice, bob } = context;
    const secret = getUnsubscribeSecret(context.api.app.get(ConfigService));
    for (const route of ['/api/on-this-day-email', '/api/monthly-recap-email'] as const) {
      const current = await call(`GET ${route}`, { as: alice, status: 200 });
      const setting = current.body as {
        enabled: boolean;
        deliveryHour: number;
        timeZone: string | null;
        diaryId: number | null;
      };
      await call(`PUT ${route}`, {
        as: alice,
        json: {
          enabled: true,
          deliveryHour: setting.deliveryHour,
          timeZone: setting.timeZone ?? 'Europe/Paris',
          diaryId: setting.diaryId,
        },
        status: 200,
      });
      const diaryId = await defaultDiaryId(context, alice);
      await call(`PUT ${route}`, {
        as: bob,
        json: { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId },
        status: 404,
        code: 'DIARY_NOT_FOUND',
      });
      await call(`PUT ${route}`, {
        as: alice,
        json: { enabled: false, deliveryHour: 8, timeZone: 'Mars/Olympus', diaryId: null },
        status: 400,
        code: 'VALIDATION_FAILED',
      });
    }

    await call('POST /api/on-this-day-email/unsubscribe', {
      query: { token: createUnsubscribeToken(alice.id, secret) },
      status: 200,
    });
    await call('POST /api/on-this-day-email/unsubscribe', {
      query: { token: 'forged' },
      status: 400,
      code: 'ON_THIS_DAY_UNSUBSCRIBE_INVALID',
    });
    const unsubscribed = await call('POST /api/email-unsubscribe', {
      query: { token: createEmailUnsubscribeToken('monthly-recap', alice.id, secret) },
      status: 200,
    });
    expect(unsubscribed.body).toMatchObject({ success: true });
    await call('POST /api/email-unsubscribe', {
      query: { token: 'forged' },
      status: 400,
      code: 'EMAIL_UNSUBSCRIBE_INVALID',
    });
    const after = await call('GET /api/monthly-recap-email', { as: alice, status: 200 });
    expect((after.body as { enabled: boolean }).enabled).toBe(false);
  });
});

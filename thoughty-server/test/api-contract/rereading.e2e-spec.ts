import { describeContract } from './contract-suite';
import { createEntry, todayIso } from './contract-fixtures';

interface Highlights {
  rereadReminders: { id: number; reread_on: string | null }[];
}

describeContract('rereading', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const dueIds = async (today: string) => {
    const response = await call('GET /api/entries/highlights', {
      as: context.alice,
      query: new URLSearchParams({ today }),
      status: 200,
    });
    return (response.body as Highlights).rereadReminders.map((entry) => entry.id);
  };

  it('asks to reread an entry on a day, shows it in Highlights from that day and clears it when done', async () => {
    const { alice, bob } = context;
    const entryId = await createEntry(context, alice, { text: 'The day we moved', date: '2025-04-01' });
    const tomorrow = todayIso(1);

    const set = await call('PUT /api/entries/{id}/reread-reminder', {
      as: alice,
      params: { id: entryId },
      json: { rereadOn: tomorrow, today: todayIso() },
      status: 200,
    });
    expect(set.body).toMatchObject({ success: true, entry: { id: entryId, reread_on: tomorrow } });
    expect(await dueIds(todayIso())).toEqual([]);
    // Tomorrow on the writer's clock, which may already be today in UTC+14
    expect(await dueIds(tomorrow)).toEqual([entryId]);

    await call('PUT /api/entries/{id}/reread-reminder', {
      as: bob,
      params: { id: entryId },
      json: { rereadOn: tomorrow, today: todayIso() },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    await call('DELETE /api/entries/{id}/reread-reminder', {
      as: bob,
      params: { id: entryId },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });

    const done = await call('DELETE /api/entries/{id}/reread-reminder', {
      as: alice,
      params: { id: entryId },
      status: 200,
    });
    expect(done.body).toMatchObject({ success: true, entry: { id: entryId, reread_on: null } });
    expect(await dueIds(tomorrow)).toEqual([]);
  });

  it('refuses today or a day past fifty years, a sealed time capsule and an entry in the recycle bin', async () => {
    const { alice } = context;
    const entryId = await createEntry(context, alice, { text: 'An ordinary day' });
    for (const rereadOn of [todayIso(), todayIso(366 * 50)]) {
      await call('PUT /api/entries/{id}/reread-reminder', {
        as: alice,
        params: { id: entryId },
        json: { rereadOn, today: todayIso() },
        status: 400,
        code: 'REREAD_DATE_INVALID',
      });
    }
    await call('PUT /api/entries/{id}/reread-reminder', {
      as: alice,
      params: { id: entryId },
      json: { rereadOn: '2026-02-30', today: todayIso() },
      status: 400,
      code: 'VALIDATION_FAILED',
    });

    const created = await call('POST /api/entries', {
      as: alice,
      json: {
        text: 'A letter to next year',
        tags: [],
        date: todayIso(),
        visibility: 'private',
        format: 'plain',
        seal: { opensOn: todayIso(365), openHour: 9, timeZone: 'Europe/Paris' },
      },
      status: 201,
    });
    await call('PUT /api/entries/{id}/reread-reminder', {
      as: alice,
      params: { id: (created.body as { entryId: number }).entryId },
      json: { rereadOn: todayIso(7), today: todayIso() },
      status: 409,
      code: 'ENTRY_SEALED',
    });

    await call('DELETE /api/entries/{id}', { as: alice, params: { id: entryId }, status: 200 });
    await call('PUT /api/entries/{id}/reread-reminder', {
      as: alice,
      params: { id: entryId },
      json: { rereadOn: todayIso(7), today: todayIso() },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
  });

  it('reads the filtered entries oldest first, one at a time with their neighbours, and only the writer’s', async () => {
    const { alice, bob } = context;
    const first = await createEntry(context, alice, { text: 'Lighthouse at dusk', tags: ['lighthouse'], date: '2023-06-02' });
    const second = await createEntry(context, alice, { text: 'Lighthouse in the fog', tags: ['lighthouse'], date: '2023-06-20' });
    const other = await createEntry(context, alice, { text: 'Not a lighthouse day', tags: ['errands'], date: '2023-06-10' });
    const read = (as: typeof alice, query: Record<string, string>, status: number) => {
      const code = ({ 400: 'VALIDATION_FAILED', 404: query.entryId ? 'ENTRY_READER_NOT_FOUND' : 'ENTRY_READER_NO_MATCH' } as const)[status as 400 | 404];
      return call('GET /api/entries/reader', { as, query: new URLSearchParams(query), status, code });
    };

    const opened = await read(alice, { tags: 'lighthouse', month: '2023-06', archiveStatus: 'active' }, 200);
    expect(opened.body).toMatchObject({ entry: { id: first, content: 'Lighthouse at dusk' }, previousId: null, nextId: second, position: 1, total: 2 });
    const next = await read(alice, { tags: 'lighthouse', entryId: String(second) }, 200);
    expect(next.body).toMatchObject({ entry: { id: second }, previousId: first, nextId: null, position: 2, total: 2 });
    await read(alice, { tags: 'lighthouse', month: '2023-01' }, 404);
    await read(alice, { tags: 'lighthouse', entryId: String(other) }, 404);
    await read(bob, { entryId: String(first) }, 404);
    await read(alice, { month: '2023-6' }, 400);
  });

  it('offers up to three of the writer’s favorite or gratitude entries, never the one just written or another writer’s', async () => {
    const { alice, bob } = context;
    const favorite = await createEntry(context, alice, { text: 'Swimming at dawn', date: '2024-07-01' });
    await call('PATCH /api/entries/{id}/favorite', { as: alice, params: { id: favorite }, json: { isFavorite: true }, status: 200 });
    const grateful = await createEntry(context, alice, { text: 'Soup from Lea', tags: ['gratitude'], date: '2024-07-02' });
    await createEntry(context, alice, { text: 'Errands', tags: ['errands'], date: '2024-07-03' });
    const justWritten = await createEntry(context, alice, { text: 'A hard day', mood: 1, tags: ['gratitude'] });
    const comfort = (as: typeof alice, query: Record<string, string>, status = 200) =>
      call('GET /api/entries/comfort-reads', { as, query: new URLSearchParams(query), status, ...(status === 400 ? { code: 'VALIDATION_FAILED' } : {}) });

    const offered = (await comfort(alice, { excludeId: String(justWritten) })).body as { entries: { id: number; excerpt: string }[] };
    expect(offered.entries.map((entry) => entry.id).sort((a, b) => a - b)).toEqual([favorite, grateful]);
    expect(offered.entries.find((entry) => entry.id === favorite)).toMatchObject({ date: '2024-07-01', index: 1, title: null, excerpt: 'Swimming at dawn' });
    expect((await comfort(bob, {})).body).toEqual({ entries: [] });
    await comfort(alice, { excludeId: 'last' }, 400);
  });
});

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
});

import { describeContract } from './contract-suite';
import { defaultDiaryId } from './contract-fixtures';
import { journalQuery, listJournalIds, writeJournal, type JournalIds } from './contract-journal';

/** Writing and reading the journal: the list and its filters, the date lookups and a random pick. */
describeContract('entries', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const listIds = (query: URLSearchParams) => listJournalIds(context, context.alice, query);
  let ids: JournalIds;

  beforeAll(async () => {
    ids = await writeJournal(context);
  });

  it('lists a page of the journal with the filters the web sends, including false and omitted flags', async () => {
    const { alice, bob } = context;
    const listed = await listIds(journalQuery());
    expect(listed).toEqual(
      expect.arrayContaining([ids.walk, ids.second, ids.tasks, ids.reference]),
    );
    expect(listed).not.toContain(ids.bob);
    expect(await listIds(journalQuery({ tags: 'river' }))).toEqual([ids.walk]);
    expect(await listIds(journalQuery({ search: 'river', sort: 'relevance' }))).toContain(ids.walk);
    expect(await listIds(journalQuery({ date: '2024-03-11' }))).toEqual([ids.tasks]);
    expect((await listIds(journalQuery({ visibility: 'private' }))).length).toBe(listed.length);
    expect(await listIds(journalQuery({ visibility: 'public' }))).toEqual([]);
    expect(await listIds(journalQuery({ mood: '4,5' }))).toEqual([ids.walk]);
    expect(await listIds(journalQuery({ ids: String(ids.walk) }))).toEqual([ids.walk]);
    // The web sends `ids=0` when a meaning search matched nothing
    expect(await listIds(journalQuery({ ids: '0' }))).toEqual([]);
    expect((await listIds(journalQuery({ favorites: 'false' }))).length).toBe(listed.length);
    expect((await listIds(journalQuery({ favorites: '0' }))).length).toBe(listed.length);
    expect(await listIds(journalQuery({ favorites: 'true' }))).toEqual([]);
    const diaryId = await defaultDiaryId(context, alice);
    expect((await listIds(journalQuery({ diaryId: String(diaryId) }))).length).toBe(listed.length);
    const foreign = await call('GET /api/entries', {
      as: bob,
      query: journalQuery({ diaryId: String(diaryId) }),
      status: 200,
    });
    expect(foreign.body).toMatchObject({ entries: [], total: 0 });
    await call('GET /api/entries', {
      as: alice,
      query: journalQuery({ favorites: 'yes' }),
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('GET /api/entries', {
      as: alice,
      query: journalQuery({ page: '1.5' }),
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('reads dates, a calendar month, highlights and the navigation lookups', async () => {
    const { alice } = context;
    const dates = await call('GET /api/entries/dates', { as: alice, status: 200 });
    expect((dates.body as { dates: string[] }).dates).toContain('2024-03-10');
    const month = await call('GET /api/entries/calendar', {
      as: alice,
      query: { month: '2024-03' },
      status: 200,
    });
    expect((month.body as { entries: unknown[] }).entries).toHaveLength(4);
    await call('GET /api/entries/calendar', {
      as: alice,
      query: {
        month: '2024-03',
        tags: 'walks',
        favorites: 'true',
        archiveStatus: 'active',
        visibility: 'private',
      },
      status: 200,
    });
    await call('GET /api/entries/calendar', {
      as: alice,
      query: { month: 'March' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('GET /api/entries/highlights', { as: alice, status: 200 });
    await call('GET /api/entries/highlights', {
      as: alice,
      query: { diaryId: String(await defaultDiaryId(context, alice)) },
      status: 200,
    });
    const first = await call('GET /api/entries/first', {
      as: alice,
      query: { year: '2024', limit: '10', month: '3' },
      status: 200,
    });
    expect(first.body).toMatchObject({ found: true });
    await call('GET /api/entries/first', { as: alice, status: 200 });
    const byDate = await call('GET /api/entries/by-date', {
      as: alice,
      query: { date: '2024-03-10', index: '2', limit: '10' },
      status: 200,
    });
    expect(byDate.body).toMatchObject({ found: true, entryId: ids.second });
    const byId = await call('GET /api/entries/by-date', {
      as: alice,
      query: { id: String(ids.tasks), limit: '10' },
      status: 200,
    });
    expect(byId.body).toMatchObject({ found: true, entryId: ids.tasks });
    const hidden = await call('GET /api/entries/by-date', {
      as: alice,
      query: { id: String(ids.bob), limit: '10' },
      status: 200,
    });
    expect(hidden.body).toMatchObject({ found: false });
    const backlinks = await call('GET /api/entries/{id}/backlinks', {
      as: alice,
      params: { id: ids.walk },
      status: 200,
    });
    expect(
      (backlinks.body as { backlinks: { id: number }[] }).backlinks.map((entry) => entry.id),
    ).toEqual([ids.reference]);
  });

  it('picks a random entry among the list filters, with its page, and moves on from the last one', async () => {
    const { alice, bob } = context;
    const random = (as: typeof alice, overrides: Record<string, string>, status: number) => {
      const query = journalQuery(overrides);
      query.delete('page');
      const code = ({ 400: 'VALIDATION_FAILED', 404: 'ENTRY_RANDOM_NO_MATCH' } as const)[status as 400 | 404];
      return call('GET /api/entries/random', { as, query, status, code });
    };
    const walks = await random(alice, { tags: 'walks', limit: '1' }, 200);
    expect([ids.walk, ids.second]).toContain((walks.body as { id: number }).id);
    expect(walks.body).toMatchObject({ date: '2024-03-10', page: expect.any(Number) });
    const next = await random(alice, { tags: 'walks', excludeId: String((walks.body as { id: number }).id) }, 200);
    expect((next.body as { id: number }).id).not.toBe((walks.body as { id: number }).id);
    expect((await random(alice, { tags: 'river' }, 200)).body).toMatchObject({ id: ids.walk, index: 1, page: 1 });
    await random(alice, { tags: 'river', favorites: 'true' }, 404);
    await random(bob, { tags: 'river' }, 404);
    await random(alice, { excludeId: 'last' }, 400);
  });
});

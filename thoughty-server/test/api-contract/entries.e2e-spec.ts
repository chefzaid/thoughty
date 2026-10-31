import { describeContract } from './contract-suite';
import { createEntry, defaultDiaryId, todayIso } from './contract-fixtures';

/**
 * The journal list's query as `useEntriesState` and `entryListParams` build it, with the filters at
 * their defaults: empty search, tags, date and visibility ("all" is sent as empty), active entries.
 */
function journalQuery(overrides: Record<string, string> = {}): URLSearchParams {
  const params = new URLSearchParams({
    page: '1',
    limit: '10',
    search: '',
    tags: '',
    date: '',
    visibility: '',
  });
  params.append('archiveStatus', 'active');
  for (const [name, value] of Object.entries(overrides)) params.set(name, value);
  return params;
}

interface ListedEntry {
  id: number;
  content: string;
  is_favorite: boolean;
  is_archived: boolean;
  is_pinned: boolean;
  visibility: string;
  tags: string[];
}

describeContract('entries', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const listIds = async (query: URLSearchParams) => {
    const response = await call('GET /api/entries', { as: context.alice, query, status: 200 });
    return (response.body as { entries: ListedEntry[] }).entries.map((entry) => entry.id);
  };
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    const { alice } = context;
    ids.walk = await createEntry(context, alice, {
      text: 'A walk by the river',
      tags: ['walks', 'river'],
      date: '2024-03-10',
      title: 'River',
      mood: 4,
    });
    ids.second = await createEntry(context, alice, {
      text: 'Another walk the same day',
      tags: ['walks'],
      date: '2024-03-10',
    });
    ids.tasks = await createEntry(context, alice, {
      text: '- [ ] buy bread\n- [ ] call mum',
      tags: ['todo'],
      date: '2024-03-11',
      format: 'markdown',
    });
    ids.reference = await createEntry(context, alice, {
      text: 'Back to [[2024-03-10]]',
      tags: [],
      date: '2024-03-12',
    });
    ids.bob = await createEntry(context, context.bob, {
      text: 'Bob’s own entry',
      tags: ['walks'],
      date: '2024-03-10',
    });
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

  it('edits an entry, keeps its revisions and refuses another writer’s', async () => {
    const { alice, bob } = context;
    const update = {
      text: 'A long walk by the river',
      tags: ['walks', 'river'],
      date: '2024-03-10',
      visibility: 'private',
      format: 'plain',
      title: 'River',
      mood: 5,
    };
    const updated = await call('PUT /api/entries/{id}', {
      as: alice,
      params: { id: ids.walk },
      json: update,
      status: 200,
    });
    expect(updated.body).toMatchObject({
      success: true,
      entry: { id: ids.walk, content: 'A long walk by the river', mood: 5 },
    });
    await call('PUT /api/entries/{id}', {
      as: bob,
      params: { id: ids.walk },
      json: update,
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    await call('PUT /api/entries/{id}', {
      as: alice,
      params: { id: ids.walk },
      json: { ...update, mood: '' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    const history = await call('GET /api/entries/{id}/history', {
      as: alice,
      params: { id: ids.walk },
      status: 200,
    });
    const revisions = history.body as { id: number; content: string }[];
    expect(revisions[0]?.content).toBe('A walk by the river');
    await call('GET /api/entries/{id}/history', {
      as: bob,
      params: { id: ids.walk },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    await call('DELETE /api/entries/{id}/history/{revisionId}', {
      as: bob,
      params: { id: ids.walk, revisionId: revisions[0]!.id },
      status: 404,
      code: 'ENTRY_REVISION_NOT_FOUND',
    });
    await call('DELETE /api/entries/{id}/history/{revisionId}', {
      as: alice,
      params: { id: ids.walk, revisionId: revisions[0]!.id },
      status: 200,
    });
  });

  it('sets and clears the flags with true and false, as the entry card does', async () => {
    const { alice, bob } = context;
    const flags = [
      ['PATCH /api/entries/{id}/favorite', 'isFavorite', 'is_favorite'],
      ['PATCH /api/entries/{id}/archive', 'isArchived', 'is_archived'],
      ['PATCH /api/entries/{id}/pinned', 'isPinned', 'is_pinned'],
    ] as const;
    for (const [operation, field, column] of flags) {
      const on = await call(operation, {
        as: alice,
        params: { id: ids.second },
        json: { [field]: true },
        status: 200,
      });
      expect((on.body as { entry: Record<string, unknown> }).entry[column]).toBe(true);
      const off = await call(operation, {
        as: alice,
        params: { id: ids.second },
        json: { [field]: false },
        status: 200,
      });
      expect((off.body as { entry: Record<string, unknown> }).entry[column]).toBe(false);
      await call(operation, {
        as: bob,
        params: { id: ids.second },
        json: { [field]: true },
        status: 404,
        code: 'ENTRY_NOT_FOUND',
      });
    }
    await call('PATCH /api/entries/{id}/favorite', {
      as: alice,
      params: { id: ids.second },
      json: { isFavorite: 'yes' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    const visible = await call('PATCH /api/entries/{id}/visibility', {
      as: alice,
      params: { id: ids.second },
      json: { visibility: 'public' },
      status: 200,
    });
    expect(visible.body).toMatchObject({ entry: { visibility: 'public' } });
    await call('PATCH /api/entries/{id}/visibility', {
      as: bob,
      params: { id: ids.second },
      json: { visibility: 'private' },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
  });

  it('ticks a Markdown task and refuses one in a plain entry', async () => {
    const { alice, bob } = context;
    const ticked = await call('PATCH /api/entries/{id}/tasks', {
      as: alice,
      params: { id: ids.tasks },
      json: { line: 1, checked: true },
      status: 200,
    });
    expect(ticked.body).toMatchObject({ entry: { content: '- [ ] buy bread\n- [x] call mum' } });
    await call('PATCH /api/entries/{id}/tasks', {
      as: alice,
      params: { id: ids.second },
      json: { line: 0, checked: true },
      status: 400,
      code: 'ENTRY_TASKS_MARKDOWN_ONLY',
    });
    await call('PATCH /api/entries/{id}/tasks', {
      as: bob,
      params: { id: ids.tasks },
      json: { line: 0, checked: true },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
  });

  it('seals a time capsule, keeps it closed and opens it early', async () => {
    const { alice, bob } = context;
    const created = await call('POST /api/entries', {
      as: alice,
      json: {
        text: 'A letter to next year',
        tags: ['future'],
        date: todayIso(),
        visibility: 'private',
        format: 'plain',
        seal: { opensOn: todayIso(365), openHour: 9, timeZone: 'Europe/Paris' },
      },
      status: 201,
    });
    const capsuleId = (created.body as { entryId: number }).entryId;
    await call('PATCH /api/entries/{id}/visibility', {
      as: alice,
      params: { id: capsuleId },
      json: { visibility: 'public' },
      status: 409,
      code: 'ENTRY_SEALED',
    });
    await call('POST /api/entries/{id}/unseal', {
      as: bob,
      params: { id: capsuleId },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    const opened = await call('POST /api/entries/{id}/unseal', {
      as: alice,
      params: { id: capsuleId },
      status: 201,
    });
    expect(opened.body).toMatchObject({ entry: { content: 'A letter to next year' } });
    await call('POST /api/entries/{id}/unseal', {
      as: alice,
      params: { id: capsuleId },
      status: 409,
      code: 'ENTRY_NOT_SEALED',
    });
  });

  it('reorders a day, renames and removes a tag, and runs bulk actions on the writer’s own entries', async () => {
    const { alice, bob } = context;
    await call('PATCH /api/entries/reorder', {
      as: alice,
      json: { date: '2024-03-10', orderedIds: [ids.second, ids.walk] },
      status: 200,
    });
    const tags = await call('GET /api/entries/tags', { as: alice, status: 200 });
    expect((tags.body as { tags: { tag: string }[] }).tags.map((usage) => usage.tag)).toContain(
      'walks',
    );
    const renamed = await call('PATCH /api/entries/tags/rename', {
      as: alice,
      json: { oldTag: 'walks', newTag: 'hikes' },
      status: 200,
    });
    expect(renamed.body).toMatchObject({ affectedCount: 2 });
    await call('PATCH /api/entries/tags/rename', {
      as: alice,
      json: { oldTag: 'hikes', newTag: 'hikes' },
      status: 400,
      code: 'TAG_RENAME_SAME_NAME',
    });
    const removed = await call('DELETE /api/entries/tags', {
      as: alice,
      query: { tag: 'hikes' },
      status: 200,
    });
    expect(removed.body).toMatchObject({ affectedCount: 2 });
    const again = await call('DELETE /api/entries/tags', {
      as: alice,
      query: { tag: 'hikes' },
      status: 200,
    });
    expect(again.body).toMatchObject({ affectedCount: 0 });

    const bulk = await call('POST /api/entries/bulk', {
      as: alice,
      json: { ids: [ids.walk, ids.second], action: 'archive', isArchived: false },
      status: 200,
    });
    expect(bulk.body).toMatchObject({ affectedCount: 2 });
    await call('POST /api/entries/bulk', {
      as: alice,
      json: { ids: [ids.walk], action: 'tags', tags: ['river'] },
      status: 200,
    });
    await call('POST /api/entries/bulk', {
      as: bob,
      json: { ids: [ids.walk], action: 'delete' },
      status: 404,
      code: 'ENTRIES_NOT_FOUND',
    });
  });

  it('moves entries to the recycle bin one by one or all at once, per diary', async () => {
    const { alice, bob } = context;
    await call('DELETE /api/entries/{id}', {
      as: bob,
      params: { id: ids.reference },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    await call('DELETE /api/entries/{id}', {
      as: alice,
      params: { id: ids.reference },
      status: 200,
    });
    const bobDiary = await defaultDiaryId(context, bob);
    // Another writer's diary holds none of the caller's entries
    const foreign = await call('DELETE /api/entries/all', {
      as: alice,
      query: { diaryId: String(bobDiary) },
      status: 200,
    });
    expect(foreign.body).toMatchObject({ deletedCount: 0 });
    const cleared = await call('DELETE /api/entries/all', { as: alice, status: 200 });
    expect((cleared.body as { deletedCount: number }).deletedCount).toBeGreaterThan(0);
    expect(await listIds(journalQuery())).toEqual([]);
    const bobList = await call('GET /api/entries', { as: bob, query: journalQuery(), status: 200 });
    expect((bobList.body as { entries: ListedEntry[] }).entries.map((entry) => entry.id)).toEqual([
      ids.bob,
    ]);
  });
});

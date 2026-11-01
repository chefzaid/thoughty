import { describeContract } from './contract-suite';
import { defaultDiaryId, todayIso } from './contract-fixtures';
import {
  journalQuery,
  listJournalIds,
  writeJournal,
  type JournalIds,
  type ListedEntry,
} from './contract-journal';

/**
 * Changing the journal: edits and their revisions, the card's flags, tasks, time capsules, tags,
 * bulk actions and moving entries to the recycle bin, each refused on another writer's entry.
 */
describeContract('entry-changes', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const listIds = (query: URLSearchParams) => listJournalIds(context, context.alice, query);
  let ids: JournalIds;

  beforeAll(async () => {
    ids = await writeJournal(context);
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

  it('lists the open tasks across the journal and ticks one in place, refusing it once the line moved', async () => {
    const { alice, bob } = context;
    const before = await call('GET /api/entries/open-tasks', { as: alice, query: { limit: '50' }, status: 200 });
    expect(before.body).toEqual({
      tasks: [
        { entryId: ids.tasks, date: '2024-03-11', title: null, line: 0, text: 'buy bread' },
        { entryId: ids.tasks, date: '2024-03-11', title: null, line: 1, text: 'call mum' },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
      nextCursor: null,
    });
    const firstPage = await call('GET /api/entries/open-tasks', { as: alice, query: { limit: '1' }, status: 200 });
    expect(firstPage.body).toMatchObject({ tasks: [{ text: 'buy bread' }], totalPages: 2, nextCursor: expect.any(String) });
    await call('PATCH /api/entries/{id}/tasks', {
      as: alice,
      params: { id: ids.tasks },
      json: { line: 1, checked: true, text: 'buy bread' },
      status: 409,
      code: 'ENTRY_TASK_STALE',
    });
    await call('PATCH /api/entries/{id}/tasks', {
      as: alice,
      params: { id: ids.tasks },
      json: { line: 0, checked: true, text: 'buy bread' },
      status: 200,
    });
    const after = await call('GET /api/entries/open-tasks', { as: alice, status: 200 });
    expect(after.body).toMatchObject({ tasks: [{ line: 1, text: 'call mum' }], total: 1 });
    // The next page starts after the task the first page ended on, though that one is ticked now
    const next = await call('GET /api/entries/open-tasks', {
      as: alice,
      query: { limit: '1', after: firstPage.body.nextCursor },
      status: 200,
    });
    expect(next.body).toMatchObject({ tasks: [{ text: 'call mum' }], page: 1, totalPages: 1, nextCursor: null });
    // Unticked again, so the next test finds the entry as it was written
    await call('PATCH /api/entries/{id}/tasks', { as: alice, params: { id: ids.tasks }, json: { line: 0, checked: false }, status: 200 });

    const others = await call('GET /api/entries/open-tasks', { as: bob, status: 200 });
    expect(others.body).toEqual({ tasks: [], total: 0, page: 1, totalPages: 0, nextCursor: null });
    await call('GET /api/entries/open-tasks', { as: alice, query: { limit: '101' }, status: 400, code: 'VALIDATION_FAILED' });
    await call('GET /api/entries/open-tasks', { as: alice, query: { after: '2' }, status: 400, code: 'VALIDATION_FAILED' });
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

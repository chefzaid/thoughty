import { describeContract } from './contract-suite';
import { createEntry, defaultDiaryId } from './contract-fixtures';

/** The journal's filters as `toSavedSearchFilters` sends them, left at their defaults. */
const DEFAULT_FILTERS = {
  search: '',
  searchMode: 'keyword',
  sort: 'relevance',
  tags: [],
  date: null,
  visibility: 'all',
  archiveStatus: 'active',
  favorites: false,
  mood: '',
  eraId: null,
  personId: null,
};

describeContract('organize', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);

  it('creates, edits, reorders, picks the default and deletes diaries, each writer their own', async () => {
    const { alice, bob } = context;
    const created = await call('POST /api/diaries', {
      as: alice,
      json: {
        name: 'Travel',
        icon: '🧭',
        color: '#2563eb',
        visibility: 'private',
        goalType: null,
        goalTarget: null,
      },
      status: 201,
    });
    const travel = created.body as { id: number; isDefault: boolean };
    expect(travel.isDefault).toBe(false);
    const goal = await call('PUT /api/diaries/{id}', {
      as: alice,
      params: { id: travel.id },
      json: {
        name: 'Trips',
        icon: '🧭',
        color: '#2563eb',
        visibility: 'public',
        goalType: 'entries_per_week',
        goalTarget: 3,
      },
      status: 200,
    });
    expect(goal.body).toMatchObject({ name: 'Trips', goalType: 'entries_per_week', goalTarget: 3 });
    await call('PUT /api/diaries/{id}', {
      as: alice,
      params: { id: travel.id },
      json: {
        name: 'Trips',
        icon: '🧭',
        color: '#2563eb',
        visibility: 'public',
        goalType: 'entries_per_week',
        goalTarget: '3',
      },
      status: 200,
    });
    await call('PUT /api/diaries/{id}', {
      as: bob,
      params: { id: travel.id },
      json: {
        name: 'Mine now',
        icon: '🧭',
        color: '#2563eb',
        visibility: 'private',
        goalType: null,
        goalTarget: null,
      },
      status: 404,
      code: 'DIARY_NOT_FOUND',
    });

    const firstDefault = await defaultDiaryId(context, alice);
    await call('PATCH /api/diaries/reorder', {
      as: alice,
      json: { orderedIds: [travel.id, firstDefault] },
      status: 200,
    });
    const listed = await call('GET /api/diaries', { as: alice, status: 200 });
    expect((listed.body as { id: number }[]).map((diary) => diary.id)).toEqual([
      travel.id,
      firstDefault,
    ]);
    await call('PATCH /api/diaries/{id}/default', {
      as: bob,
      params: { id: travel.id },
      status: 404,
      code: 'DIARY_NOT_FOUND',
    });
    const madeDefault = await call('PATCH /api/diaries/{id}/default', {
      as: alice,
      params: { id: travel.id },
      status: 200,
    });
    expect(madeDefault.body).toMatchObject({ id: travel.id, isDefault: true });
    await call('DELETE /api/diaries/{id}', {
      as: alice,
      params: { id: travel.id },
      status: 400,
      code: 'DIARY_DEFAULT_NOT_DELETABLE',
    });
    await call('PATCH /api/diaries/{id}/default', {
      as: alice,
      params: { id: firstDefault },
      status: 200,
    });
    await call('DELETE /api/diaries/{id}', {
      as: bob,
      params: { id: travel.id },
      status: 404,
      code: 'DIARY_NOT_FOUND',
    });
    await call('DELETE /api/diaries/{id}', { as: alice, params: { id: travel.id }, status: 200 });
  });

  it('refuses a second diary of the same name, ignoring case and spaces, as the diary form sends it', async () => {
    const { alice, bob } = context;
    const form = (name: string) => ({ name, icon: '📓', visibility: 'private', goalType: null, goalTarget: null });
    const dreams = await call('POST /api/diaries', { as: alice, json: form('Dreams'), status: 201 });
    const dreamsId = (dreams.body as { id: number }).id;
    await call('POST /api/diaries', { as: alice, json: form('  dreams '), status: 409, code: 'DIARY_NAME_TAKEN' });
    await call('POST /api/diaries', { as: bob, json: form('Dreams'), status: 201 });

    const ideas = await call('POST /api/diaries', { as: alice, json: form('Ideas'), status: 201 });
    const ideasId = (ideas.body as { id: number }).id;
    await call('PUT /api/diaries/{id}', {
      as: alice,
      params: { id: ideasId },
      json: form('DREAMS'),
      status: 409,
      code: 'DIARY_NAME_TAKEN',
    });
    const recased = await call('PUT /api/diaries/{id}', {
      as: alice,
      params: { id: dreamsId },
      json: form('DREAMS'),
      status: 200,
    });
    expect(recased.body).toMatchObject({ id: dreamsId, name: 'DREAMS' });

    const listed = await call('GET /api/diaries', { as: alice, status: 200 });
    expect((listed.body as { name: string }[]).map((diary) => diary.name)).toEqual(
      expect.arrayContaining(['DREAMS', 'Ideas']),
    );
    expect((listed.body as { name: string }[]).filter((diary) => diary.name.toLowerCase() === 'dreams')).toHaveLength(1);
  });

  it('saves, renames and deletes saved searches for all diaries or one', async () => {
    const { alice, bob } = context;
    const diaryId = await defaultDiaryId(context, alice);
    const saved = await call('POST /api/saved-searches', {
      as: alice,
      json: { name: 'Everything', diaryId: null, filters: DEFAULT_FILTERS },
      status: 201,
    });
    const savedId = (saved.body as { id: number }).id;
    await call('POST /api/saved-searches', {
      as: alice,
      json: {
        name: 'Walks',
        diaryId,
        filters: {
          ...DEFAULT_FILTERS,
          search: 'walk',
          tags: ['walks'],
          favorites: true,
          mood: '4,5',
          date: '2024-03-10',
        },
      },
      status: 201,
    });
    await call('POST /api/saved-searches', {
      as: alice,
      json: { name: 'everything', diaryId: null, filters: DEFAULT_FILTERS },
      status: 409,
      code: 'SAVED_SEARCH_NAME_TAKEN',
    });
    await call('POST /api/saved-searches', {
      as: bob,
      json: { name: 'Hers', diaryId, filters: DEFAULT_FILTERS },
      status: 404,
      code: 'DIARY_NOT_FOUND',
    });
    const listed = await call('GET /api/saved-searches', { as: alice, status: 200 });
    expect((listed.body as { savedSearches: unknown[] }).savedSearches).toHaveLength(2);
    const bobs = await call('GET /api/saved-searches', { as: bob, status: 200 });
    expect((bobs.body as { savedSearches: unknown[] }).savedSearches).toEqual([]);
    await call('PATCH /api/saved-searches/{id}', {
      as: alice,
      params: { id: savedId },
      json: { name: 'All of it' },
      status: 200,
    });
    await call('PATCH /api/saved-searches/{id}', {
      as: bob,
      params: { id: savedId },
      json: { name: 'Mine' },
      status: 404,
      code: 'SAVED_SEARCH_NOT_FOUND',
    });
    await call('DELETE /api/saved-searches/{id}', {
      as: bob,
      params: { id: savedId },
      status: 404,
      code: 'SAVED_SEARCH_NOT_FOUND',
    });
    await call('DELETE /api/saved-searches/{id}', {
      as: alice,
      params: { id: savedId },
      status: 200,
    });
  });

  it('keeps life eras with valid dates and unique names', async () => {
    const { alice, bob } = context;
    const created = await call('POST /api/life-eras', {
      as: alice,
      json: {
        name: 'University',
        startDate: '2010-09-01',
        endDate: '2014-06-30',
        color: '#16a34a',
        emoji: '🎓',
        note: 'Lyon',
      },
      status: 201,
    });
    const eraId = (created.body as { id: number }).id;
    await call('POST /api/life-eras', {
      as: alice,
      json: { name: 'Now', startDate: '2020-01-01' },
      status: 201,
    });
    await call('POST /api/life-eras', {
      as: alice,
      json: { name: 'university', startDate: '2011-01-01' },
      status: 409,
      code: 'LIFE_ERA_NAME_TAKEN',
    });
    await call('POST /api/life-eras', {
      as: alice,
      json: { name: 'Backwards', startDate: '2014-01-01', endDate: '2013-01-01' },
      status: 400,
      code: 'LIFE_ERA_DATES_INVALID',
    });
    const updated = await call('PATCH /api/life-eras/{id}', {
      as: alice,
      params: { id: eraId },
      json: { endDate: null, note: '' },
      status: 200,
    });
    expect(updated.body).toMatchObject({ id: eraId, endDate: null });
    await call('PATCH /api/life-eras/{id}', {
      as: bob,
      params: { id: eraId },
      json: { name: 'Mine' },
      status: 404,
      code: 'LIFE_ERA_NOT_FOUND',
    });
    const listed = await call('GET /api/life-eras', { as: alice, status: 200 });
    expect((listed.body as { lifeEras: unknown[] }).lifeEras).toHaveLength(2);
    await call('DELETE /api/life-eras/{id}', {
      as: bob,
      params: { id: eraId },
      status: 404,
      code: 'LIFE_ERA_NOT_FOUND',
    });
    await call('DELETE /api/life-eras/{id}', { as: alice, params: { id: eraId }, status: 200 });
  });

  it('lists the people entries mention, renames, merges and deletes them', async () => {
    const { alice, bob } = context;
    await createEntry(context, alice, { text: 'Lunch with @Marie and @Jean-Paul' });
    await createEntry(context, alice, { text: 'Called @MarieD again' });
    const listed = await call('GET /api/people', { as: alice, status: 200 });
    const people = (listed.body as { people: { id: number; name: string }[] }).people;
    const byName = (name: string) => {
      const person = people.find(
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
      );
      if (!person) throw new Error(`No person named ${name} in ${JSON.stringify(people)}`);
      return person.id;
    };
    const marie = byName('Marie');
    const duplicate = byName('MarieD');
    const bobsPeople = await call('GET /api/people', { as: bob, status: 200 });
    expect((bobsPeople.body as { people: unknown[] }).people).toEqual([]);

    const renamed = await call('PATCH /api/people/{id}', {
      as: alice,
      params: { id: marie },
      json: { name: 'Marie Curie' },
      status: 200,
    });
    expect(renamed.body).toMatchObject({ id: marie, name: 'Marie Curie' });
    await call('PATCH /api/people/{id}', {
      as: bob,
      params: { id: marie },
      json: { name: 'Mine' },
      status: 404,
      code: 'PERSON_NOT_FOUND',
    });
    await call('POST /api/people/{id}/merge', {
      as: alice,
      params: { id: marie },
      json: { duplicateId: marie },
      status: 400,
      code: 'PERSON_MERGE_SAME',
    });
    await call('POST /api/people/{id}/merge', {
      as: bob,
      params: { id: marie },
      json: { duplicateId: duplicate },
      status: 404,
      code: 'PERSON_NOT_FOUND',
    });
    const merged = await call('POST /api/people/{id}/merge', {
      as: alice,
      params: { id: marie },
      json: { duplicateId: duplicate },
      status: 200,
    });
    expect(merged.body).toMatchObject({ id: marie });
    await call('DELETE /api/people/{id}', {
      as: bob,
      params: { id: marie },
      status: 404,
      code: 'PERSON_NOT_FOUND',
    });
    await call('DELETE /api/people/{id}', {
      as: alice,
      params: { id: byName('Jean-Paul') },
      status: 200,
    });
  });

  it('restores and deletes entries from the recycle bin, each writer their own', async () => {
    const { alice, bob } = context;
    const binned = [
      await createEntry(context, alice, { text: 'First binned' }),
      await createEntry(context, alice, { text: 'Second binned' }),
      await createEntry(context, alice, { text: 'Third binned' }),
    ];
    for (const id of binned) {
      await call('DELETE /api/entries/{id}', { as: alice, params: { id }, status: 200 });
    }
    const page = await call('GET /api/recycle-bin', {
      as: alice,
      query: { page: '1', limit: '2' },
      status: 200,
    });
    expect(page.body).toMatchObject({ total: 3, totalPages: 2 });
    await call('GET /api/recycle-bin', {
      as: alice,
      query: { page: '0', limit: '2' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('POST /api/recycle-bin/restore', {
      as: bob,
      json: { ids: [binned[0]] },
      status: 404,
      code: 'RECYCLE_BIN_ENTRIES_NOT_FOUND',
    });
    await call('POST /api/recycle-bin/restore', {
      as: alice,
      json: { ids: [binned[0]], inPlace: true },
      status: 200,
    });
    await call('POST /api/recycle-bin/restore', {
      as: alice,
      json: { ids: [binned[1]], inPlace: 'yes' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('POST /api/recycle-bin/delete', {
      as: bob,
      json: { ids: [binned[1]] },
      status: 404,
      code: 'RECYCLE_BIN_ENTRIES_NOT_FOUND',
    });
    await call('POST /api/recycle-bin/delete', {
      as: alice,
      json: { ids: [binned[1]] },
      status: 200,
    });
    await call('POST /api/recycle-bin/restore-all', {
      as: bob,
      status: 404,
      code: 'RECYCLE_BIN_ENTRIES_NOT_FOUND',
    });
    await call('POST /api/recycle-bin/restore-all', { as: alice, status: 200 });
    await call('DELETE /api/entries/{id}', { as: alice, params: { id: binned[2]! }, status: 200 });
    const emptied = await call('DELETE /api/recycle-bin', { as: alice, status: 200 });
    expect(emptied.body).toMatchObject({ deletedCount: 1 });
    const after = await call('GET /api/recycle-bin', {
      as: alice,
      query: { page: '1', limit: '20' },
      status: 200,
    });
    expect(after.body).toMatchObject({ total: 0 });
  });
});

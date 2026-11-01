import { describeContract } from './contract-suite';
import { PNG_PIXEL } from './contract-fixtures';

/** The imports the browser parses from another app's export (ADR 0020): its entries in batches, then their files. */
describeContract('app-import', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);

  it('imports a Day One journal with its photos in multipart batches', async () => {
    const { alice, bob } = context;
    const imported = await call('POST /api/io/import/entries', {
      as: alice,
      json: {
        source: 'dayone',
        journalsAsDiaries: false,
        diaryId: null,
        entries: [
          {
            sourceId: 'DO-1',
            date: '2023-01-02',
            timeOfDay: '08:15',
            content: 'Snow day',
            tags: ['winter'],
            favorite: true,
            mood: 4,
          },
          { sourceId: 'DO-2', date: '2023-01-03', content: 'Thaw ![Melt](attachment:snow.png)', tags: [] },
        ],
      },
      status: 200,
    });
    const body = imported.body as {
      importedCount: number;
      entries: { sourceId: string; entryId: number }[];
    };
    expect(body.importedCount).toBe(2);
    const again = await call('POST /api/io/import/entries', {
      as: alice,
      json: {
        source: 'dayone',
        entries: [{ sourceId: 'DO-1', date: '2023-01-02', content: 'Snow day', tags: [] }],
      },
      status: 200,
    });
    expect(again.body).toMatchObject({ importedCount: 0, alreadyImportedCount: 1 });

    const entryId = body.entries[0]!.entryId;
    const photo = {
      field: 'files',
      buffer: PNG_PIXEL,
      filename: 'snow.png',
      contentType: 'image/png',
    };
    const attached = await call('POST /api/io/import/attachments', {
      as: alice,
      multipart: { fields: { entryIds: String(entryId) }, files: [photo] },
      status: 200,
    });
    expect((attached.body as { attachments: unknown[] }).attachments).toHaveLength(1);
    // The inline photo named in the text becomes a reference once its file is stored
    const thawId = body.entries[1]!.entryId;
    const thawPhoto = await call('POST /api/io/import/attachments', {
      as: alice,
      multipart: { fields: { entryIds: String(thawId) }, files: [photo] },
      status: 200,
    });
    const [stored] = (thawPhoto.body as { attachments: { id: number }[] }).attachments;
    const thaw = await call('GET /api/entries', {
      as: alice,
      query: new URLSearchParams({ page: '1', limit: '10', ids: String(thawId), archiveStatus: 'active' }),
      status: 200,
    });
    expect((thaw.body as { entries: { content: string }[] }).entries[0]!.content).toBe(`Thaw ![Melt](attachment:${stored!.id})`);
    await call('POST /api/io/import/attachments', {
      as: bob,
      multipart: { fields: { entryIds: String(entryId) }, files: [photo] },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
  });

  it('imports daily notes by their path in the archive into the chosen diary, inline pictures included, once', async () => {
    const { alice } = context;
    const diary = await call('POST /api/diaries', {
      as: alice,
      json: { name: 'Obsidian', visibility: 'private', goalType: null, goalTarget: null },
      status: 201,
    });
    const diaryId = (diary.body as { id: number }).id;
    // What the browser sends for `Vault/journals/2024_03_14.md` and `Vault/Daily Notes/2024-03-15.md` (a hash for the space)
    const notes = {
      source: 'daily-notes',
      diaryId,
      journalsAsDiaries: false,
      entries: [
        { sourceId: 'Vault/journals/2024_03_14.md', date: '2024-03-14', content: '- Pier ![pier.png](attachment:pier.png)\n- [[2024-03-13]]', tags: ['work'] },
        { sourceId: '2024-03-15.0f3a9c2b5d7e1a46', date: '2024-03-15', content: '# Friday #weather', tags: ['weather'] },
      ],
    };
    const imported = await call('POST /api/io/import/entries', { as: alice, json: notes, status: 200 });
    const [pierNote] = (imported.body as { entries: { entryId: number }[] }).entries;
    const again = await call('POST /api/io/import/entries', { as: alice, json: notes, status: 200 });
    expect(again.body).toMatchObject({ importedCount: 0, alreadyImportedCount: 2 });

    const attached = await call('POST /api/io/import/attachments', {
      as: alice,
      multipart: {
        fields: { entryIds: String(pierNote!.entryId) },
        files: [{ field: 'files', buffer: PNG_PIXEL, filename: 'pier.png', contentType: 'image/png' }],
      },
      status: 200,
    });
    const [photo] = (attached.body as { attachments: { id: number }[] }).attachments;
    const listed = await call('GET /api/entries', {
      as: alice,
      query: new URLSearchParams({ page: '1', limit: '10', diaryId: String(diaryId), archiveStatus: 'active' }),
      status: 200,
    });
    const entries = (listed.body as { entries: { date: string; content: string; tags: string[]; visibility: string }[] }).entries;
    expect(entries.map(({ date, content, tags, visibility }) => ({ date, content, tags, visibility }))).toEqual([
      { date: '2024-03-15', content: '# Friday #weather', tags: ['weather'], visibility: 'private' },
      { date: '2024-03-14', content: `- Pier ![pier.png](attachment:${photo!.id})\n- [[2024-03-13]]`, tags: ['work'], visibility: 'private' },
    ]);

    await call('POST /api/io/import/entries', {
      as: alice,
      json: { ...notes, entries: [{ ...notes.entries[0]!, sourceId: 'Daily Notes/2024-03-14.md' }] },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('POST /api/io/import/entries', { as: alice, json: { ...notes, source: 'obsidian' }, status: 400, code: 'VALIDATION_FAILED' });
  });

  it('imports Google Keep notes with their titles, checklists, labels and archived and pinned flags, once', async () => {
    const { alice } = context;
    // What the browser builds from `Takeout/Keep/Groceries.json` and `Takeout/Keep/Trip ideas.json` (a hash for the space),
    // dated in the writer's zone; the note in Keep's bin is never sent
    const takeout = {
      source: 'keep',
      journalsAsDiaries: false,
      entries: [
        {
          sourceId: '2023-06-01.d542f897f89e26d2',
          date: '2023-06-01',
          timeOfDay: '18:30',
          title: 'Trip ideas',
          content: '![](attachment:18e2c1f0a9b.5d3c2b1a.jpg)\n\nLisbon in spring',
          tags: ['Travel plans'],
          favorite: false,
          archived: true,
        },
        {
          sourceId: 'Groceries',
          date: '2024-03-14',
          timeOfDay: '01:00',
          title: 'Groceries',
          content: 'For Saturday\n\n- [ ] Milk\n- [x] Bread',
          tags: ['Shopping'],
          favorite: false,
          pinned: true,
        },
      ],
    };
    const imported = await call('POST /api/io/import/entries', { as: alice, json: takeout, status: 200 });
    expect(imported.body).toMatchObject({ importedCount: 2, alreadyImportedCount: 0 });
    const [trip, groceries] = (imported.body as { entries: { entryId: number }[] }).entries;
    const again = await call('POST /api/io/import/entries', { as: alice, json: takeout, status: 200 });
    expect(again.body).toMatchObject({ importedCount: 0, alreadyImportedCount: 2 });

    const attached = await call('POST /api/io/import/attachments', {
      as: alice,
      multipart: {
        fields: { entryIds: String(trip!.entryId) },
        files: [{ field: 'files', buffer: PNG_PIXEL, filename: '18e2c1f0a9b.5d3c2b1a.jpg', contentType: 'image/png' }],
      },
      status: 200,
    });
    const [photo] = (attached.body as { attachments: { id: number }[] }).attachments;
    type Listed = { title: string | null; time_of_day: string | null; content: string; tags: string[]; is_archived: boolean; is_pinned: boolean };
    const list = async (archiveStatus: string) => ((await call('GET /api/entries', {
      as: alice,
      query: new URLSearchParams({ page: '1', limit: '10', ids: `${trip!.entryId},${groceries!.entryId}`, archiveStatus }),
      status: 200,
    })).body as { entries: Listed[] }).entries;
    expect((await list('archived')).map(({ title, time_of_day, content, tags, is_archived, is_pinned }) => ({ title, time_of_day, content, tags, is_archived, is_pinned }))).toEqual([
      {
        title: 'Trip ideas',
        time_of_day: '18:30',
        content: `![](attachment:${photo!.id})\n\nLisbon in spring`,
        tags: ['Travel plans'],
        is_archived: true,
        is_pinned: false,
      },
    ]);
    expect((await list('active')).map(({ title, content, is_pinned }) => ({ title, content, is_pinned }))).toEqual([
      { title: 'Groceries', content: 'For Saturday\n\n- [ ] Milk\n- [x] Bread', is_pinned: true },
    ]);

    await call('POST /api/io/import/entries', {
      as: alice,
      json: { ...takeout, entries: [{ ...takeout.entries[1]!, pinned: 'yes' }] },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });
});

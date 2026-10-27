import { describeContract } from './contract-suite';
import { createEntry, defaultDiaryId, PNG_PIXEL } from './contract-fixtures';

/** The converter's options with the AI narrative off, as `buildParams` sends them. */
const PLAIN_BOOK = { narrative: 'false' };
const COVER = {
  field: 'coverImage',
  buffer: PNG_PIXEL,
  filename: 'cover.png',
  contentType: 'image/png',
};

describeContract('books', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);
  const entryIds: number[] = [];

  beforeAll(async () => {
    const { alice } = context;
    entryIds.push(
      await createEntry(context, alice, {
        text: 'Spring walk',
        tags: ['walks'],
        date: '2024-04-01',
      }),
    );
    entryIds.push(
      await createEntry(context, alice, { text: 'Summer swim', tags: ['sea'], date: '2024-07-01' }),
    );
    entryIds.push(
      await createEntry(context, alice, { text: 'Untagged thought', date: '2024-08-01' }),
    );
  });

  it('previews the chapters with the flags on, off and left out', async () => {
    const { alice } = context;
    const preview = await call('GET /api/books/preview', {
      as: alice,
      query: PLAIN_BOOK,
      status: 200,
    });
    expect(preview.body).toMatchObject({ entryCount: 3 });
    const tagged = await call('GET /api/books/preview', {
      as: alice,
      query: { ...PLAIN_BOOK, includeUntagged: 'false' },
      status: 200,
    });
    expect(tagged.body).toMatchObject({ entryCount: 2 });
    const byYear = await call('GET /api/books/preview', {
      as: alice,
      query: { ...PLAIN_BOOK, chapterMode: 'year', chapterOrder: 'chrono' },
      status: 200,
    });
    expect(byYear.body).toMatchObject({ chapterCount: 1 });
    // The converter's default keeps the AI narrative on, which needs a key this server does not have
    await call('GET /api/books/preview', { as: alice, status: 200 });
    await call('GET /api/books/export', {
      as: alice,
      query: { format: 'md' },
      status: 400,
      code: 'BOOK_AI_NARRATIVE_KEY_REQUIRED',
    });
    await call('GET /api/books/export', {
      as: alice,
      query: { ...PLAIN_BOOK, chapterFraming: 'true', format: 'md' },
      status: 400,
      code: 'BOOK_AI_FRAMING_KEY_REQUIRED',
    });
    await call('GET /api/books/preview', {
      as: alice,
      query: { narrative: 'maybe' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('exports a book in each format, with the dates and contents when asked', async () => {
    const { alice } = context;
    const markdown = (query: Record<string, string>) =>
      call('GET /api/books/export', {
        as: alice,
        query: { ...PLAIN_BOOK, format: 'md', ...query },
        status: 200,
        contentType: /^text\/markdown/,
      });
    const full = (await markdown({})).text;
    const bare = (await markdown({ includeToc: 'false', includeDates: 'false' })).text;
    expect(full).toContain('2024');
    expect(bare.length).toBeLessThan(full.length);
    const zeros = (await markdown({ includeToc: '0', includeDates: '0' })).text;
    expect(zeros).toBe(bare);

    await call('GET /api/books/export', {
      as: alice,
      query: PLAIN_BOOK,
      status: 200,
      contentType: /^application\/pdf/,
    });
    await call('GET /api/books/export', {
      as: alice,
      query: { ...PLAIN_BOOK, format: 'epub' },
      status: 200,
      contentType: /^application\/epub\+zip/,
    });
    await call('GET /api/books/export', {
      as: alice,
      query: { ...PLAIN_BOOK, format: 'html', title: 'My year', author: 'Alice' },
      status: 200,
      contentType: /^text\/html/,
    });
    // A cover is sent as multipart, as the converter's `FormData`
    await call('POST /api/books/export', {
      as: alice,
      query: PLAIN_BOOK,
      multipart: { files: [COVER] },
      status: 200,
      contentType: /^application\/pdf/,
    });
    await call('POST /api/books/export', {
      as: alice,
      query: PLAIN_BOOK,
      multipart: {
        files: [{ ...COVER, buffer: Buffer.from('not an image'), contentType: 'image/png' }],
      },
      status: 400,
      code: 'BOOK_COVER_INVALID',
    });
  });

  it('makes a book of hand-picked entries, never another writer’s', async () => {
    const { alice, bob } = context;
    const picked = await call('GET /api/books/picked-entries', {
      as: alice,
      query: { entryIds: entryIds.slice(0, 2).join(',') },
      status: 200,
    });
    expect(picked.body).toMatchObject({ missingIds: [] });
    const foreign = await call('GET /api/books/picked-entries', {
      as: bob,
      query: { entryIds: entryIds.join(',') },
      status: 200,
    });
    expect(foreign.body).toMatchObject({ entries: [], missingIds: entryIds });
    const preview = await call('GET /api/books/preview', {
      as: alice,
      query: { source: 'entries', entryIds: String(entryIds[0]), ...PLAIN_BOOK },
      status: 200,
    });
    expect(preview.body).toMatchObject({ entryCount: 1 });
    await call('GET /api/books/preview', {
      as: bob,
      query: { source: 'entries', entryIds: String(entryIds[0]), ...PLAIN_BOOK },
      status: 400,
      code: 'BOOK_PICKED_ENTRIES_UNAVAILABLE',
    });
    await call('GET /api/books/preview', {
      as: alice,
      query: { source: 'savedSearch', ...PLAIN_BOOK },
      status: 400,
      code: 'BOOK_SAVED_SEARCH_REQUIRED',
    });
  });

  it('saves versions with and without a cover and downloads them, each writer their own', async () => {
    const { alice, bob } = context;
    const diaryId = String(await defaultDiaryId(context, alice));
    // No cover: the converter posts no body at all
    const first = await call('POST /api/books/versions', {
      as: alice,
      query: { ...PLAIN_BOOK, diaryId },
      status: 201,
    });
    const second = await call('POST /api/books/versions', {
      as: alice,
      query: { ...PLAIN_BOOK, diaryId },
      multipart: { files: [COVER] },
      status: 201,
    });
    expect((second.body as { versionNumber: number }).versionNumber).toBe(
      (first.body as { versionNumber: number }).versionNumber + 1,
    );
    const listed = await call('GET /api/books/versions', {
      as: alice,
      query: { diaryId },
      status: 200,
    });
    expect(listed.body).toHaveLength(2);
    const everything = await call('GET /api/books/versions', { as: alice, status: 200 });
    expect(everything.body).toEqual([]);
    const versionId = (first.body as { id: number }).id;
    await call('GET /api/books/versions/{versionId}/download', {
      as: alice,
      params: { versionId },
      status: 200,
      contentType: /^application\/pdf/,
    });
    await call('GET /api/books/versions/{versionId}/download', {
      as: bob,
      params: { versionId },
      status: 404,
      code: 'BOOK_VERSION_NOT_FOUND',
    });
    const foreign = await call('GET /api/books/versions', {
      as: bob,
      query: { diaryId },
      status: 200,
    });
    expect(foreign.body).toEqual([]);
  });

  it('refuses to upload a book to a cloud drive that is not connected', async () => {
    await call('POST /api/books/upload', {
      as: context.alice,
      query: { ...PLAIN_BOOK, provider: 'dropbox' },
      status: 400,
      code: 'CLOUD_NOT_CONNECTED',
    });
  });
});

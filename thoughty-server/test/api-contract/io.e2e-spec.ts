import { CONTRACT_BUCKET } from './contract-app';
import { describeContract } from './contract-suite';
import { createEntry, defaultDiaryId, PNG_PIXEL } from './contract-fixtures';

const EXPORT_TYPES: Record<string, RegExp> = {
  txt: /^text\/plain/,
  json: /^application\/json/,
  md: /^text\/markdown/,
  csv: /^text\/csv/,
  html: /^text\/html/,
  pdf: /^application\/pdf/,
  epub: /^application\/epub\+zip/,
  zip: /^application\/zip/,
};

describeContract('io', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);

  beforeAll(async () => {
    await createEntry(context, context.alice, {
      text: 'Exported walk',
      tags: ['walks'],
      date: '2024-05-01',
      visibility: 'public',
    });
    await createEntry(context, context.alice, {
      text: 'Exported note',
      tags: [],
      date: '2024-05-02',
    });
  });

  it('reads and saves the text format the import and export use', async () => {
    const { alice } = context;
    const current = await call('GET /api/io/format', { as: alice, status: 200 });
    await call('POST /api/io/format', {
      as: alice,
      json: { ...(current.body as object), titlePlacement: 'firstLine' },
      status: 200,
    });
    const saved = await call('GET /api/io/format', { as: alice, status: 200 });
    expect(saved.body).toMatchObject({ titlePlacement: 'firstLine' });
    await call('POST /api/io/format', {
      as: alice,
      json: { titlePlacement: 'footer' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    await call('POST /api/io/format', {
      as: alice,
      json: { ...(current.body as object) },
      status: 200,
    });
  });

  it('exports every format, with visibility only when asked, and never another writer’s diary', async () => {
    const { alice, bob } = context;
    for (const [format, contentType] of Object.entries(EXPORT_TYPES)) {
      const query: Record<string, string> = format === 'txt' ? {} : { format };
      const exported = await call('GET /api/io/export', {
        as: alice,
        query,
        status: 200,
        contentType,
      });
      expect(String(exported.headers['content-disposition'])).toMatch(/^attachment; filename="/);
    }
    const keys = async (query: Record<string, string>) => {
      const response = await call('GET /api/io/export', {
        as: alice,
        query: { format: 'json', ...query },
        status: 200,
        contentType: /^application\/json/,
      });
      return Object.keys(
        (response.body as { entries: Record<string, unknown>[] }).entries[0] ?? {},
      );
    };
    expect(await keys({ includeVisibility: 'true' })).toContain('visibility');
    expect(await keys({})).not.toContain('visibility');
    expect(await keys({ includeVisibility: 'false' })).not.toContain('visibility');
    expect(await keys({ includeVisibility: '0' })).not.toContain('visibility');
    await call('GET /api/io/export', {
      as: alice,
      query: { includeVisibility: 'no' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    // Another writer's diary holds none of the caller's entries
    const bobDiary = await defaultDiaryId(context, bob);
    const foreign = await call('GET /api/io/export', {
      as: alice,
      query: { diaryId: String(bobDiary) },
      status: 200,
      contentType: /^text\/plain/,
    });
    expect(foreign.text).toBe('');
  });

  it('previews and imports a text file into all diaries or one, skipping duplicates', async () => {
    const { alice, bob } = context;
    const exported = await call('GET /api/io/export', {
      as: alice,
      status: 200,
      contentType: /^text\/plain/,
    });
    const content = exported.text;
    const preview = await call('POST /api/io/preview', {
      as: alice,
      json: { content, diaryId: null },
      status: 200,
    });
    expect(JSON.stringify(preview.body)).toContain('Exported walk');
    const skipped = await call('POST /api/io/import', {
      as: alice,
      json: { content, skipDuplicates: true, diaryId: null },
      status: 200,
    });
    expect(skipped.body).toMatchObject({ importedCount: 0, skippedCount: 2 });
    const bobDiary = await defaultDiaryId(context, bob);
    const imported = await call('POST /api/io/import', {
      as: bob,
      json: { content, skipDuplicates: false, diaryId: bobDiary },
      status: 200,
    });
    expect(imported.body).toMatchObject({ importedCount: 2 });
    await call('POST /api/io/import', {
      as: alice,
      json: { content, skipDuplicates: false, diaryId: bobDiary },
      status: 404,
      code: 'DIARY_NOT_FOUND',
    });
    await call('POST /api/io/import', {
      as: alice,
      json: { content: '', skipDuplicates: true, diaryId: null },
      status: 400,
      code: 'IMPORT_CONTENT_REQUIRED',
    });
  });

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
          { sourceId: 'DO-2', date: '2023-01-03', content: 'Thaw', tags: [] },
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
    await call('POST /api/io/import/attachments', {
      as: bob,
      multipart: { fields: { entryIds: String(entryId) }, files: [photo] },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
  });

  it('uploads, serves, links and deletes attachments in object storage, scoped to their owner', async () => {
    const { alice, bob } = context;
    const entryId = await createEntry(context, alice, { text: 'With a photo' });
    const png = {
      field: 'file',
      buffer: PNG_PIXEL,
      filename: 'photo.png',
      contentType: 'image/png',
    };
    // The upload bug the contract layer exists for: a body sent as JSON never carries the file
    await call('POST /api/attachments/upload', {
      as: alice,
      json: { entryId },
      status: 400,
      code: 'ATTACHMENT_FILE_MISSING',
    });
    await call('POST /api/attachments/upload', {
      as: alice,
      multipart: { files: [{ ...png, filename: 'page.html', contentType: 'text/html' }] },
      status: 400,
      code: 'ATTACHMENT_TYPE_NOT_ALLOWED',
    });
    await call('POST /api/attachments/upload', {
      as: bob,
      multipart: { fields: { entryId: String(entryId) }, files: [png] },
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    });
    const uploaded = await call('POST /api/attachments/upload', {
      as: alice,
      multipart: { files: [png] },
      status: 201,
    });
    const attachment = uploaded.body as { id: number; stored_filename: string };
    expect(context.api.storage.keys(CONTRACT_BUCKET)).toContain(attachment.stored_filename);

    const served = await call('GET /api/attachments/file/{filename}', {
      as: alice,
      params: { filename: attachment.stored_filename },
      status: 200,
      contentType: /^image\/png/,
    });
    expect(Buffer.compare(served.body as Buffer, PNG_PIXEL)).toBe(0);
    await call('GET /api/attachments/file/{filename}', {
      as: bob,
      params: { filename: attachment.stored_filename },
      status: 404,
      code: 'ATTACHMENT_FILE_NOT_FOUND',
    });

    await call('POST /api/attachments/{id}/link', {
      as: bob,
      params: { id: attachment.id },
      json: { entryId },
      status: 404,
      code: 'ATTACHMENT_NOT_FOUND',
    });
    await call('POST /api/attachments/{id}/link', {
      as: alice,
      params: { id: attachment.id },
      json: { entryId },
      status: 200,
    });
    await call('POST /api/attachments/{id}/transcribe', {
      as: alice,
      params: { id: attachment.id },
      status: 400,
      code: 'ATTACHMENT_NOT_AUDIO',
    });
    const audio = await call('POST /api/attachments/upload', {
      as: alice,
      multipart: {
        fields: { entryId: String(entryId) },
        files: [
          {
            field: 'file',
            buffer: Buffer.from('ID3'),
            filename: 'memo.mp3',
            contentType: 'audio/mpeg',
          },
        ],
      },
      status: 201,
    });
    // No OpenRouter key: transcription fails cleanly with its documented code
    await call('POST /api/attachments/{id}/transcribe', {
      as: alice,
      params: { id: (audio.body as { id: number }).id },
      status: 400,
      code: 'AI_KEY_NOT_CONFIGURED',
    });

    await call('DELETE /api/attachments/{id}', {
      as: bob,
      params: { id: attachment.id },
      status: 404,
      code: 'ATTACHMENT_NOT_FOUND',
    });
    await call('DELETE /api/attachments/{id}', {
      as: alice,
      params: { id: attachment.id },
      status: 200,
    });
    expect(context.api.storage.keys(CONTRACT_BUCKET)).not.toContain(attachment.stored_filename);
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppImportService, ImportResult } from '../../../services/api/appImportService';
import { buildZip } from '../../../test/zipFixture';
import { readZipEntries, type ZipEntry } from '../../../utils/zipReader';
import type { AppExport, ImportedEntry, ImportedMedia } from './appImportTypes';
import { AppImportError, runAppImport } from './runAppImport';
import { shrinkPhoto } from './shrinkPhoto';

vi.mock('./shrinkPhoto', () => ({ shrinkPhoto: vi.fn() }));

type ImportEntries = AppImportService['importEntries'];
type UploadAttachments = AppImportService['uploadAttachments'];

const ok = <T,>(data: T): ImportResult<T> => ({ ok: true, data });
const failure = (status: number, retryAfterSeconds?: number) => ({ ok: false as const, error: `HTTP ${status}`, status, retryAfterSeconds });

describe('runAppImport', () => {
  let archive: Blob;
  let files: Map<string, ZipEntry>;
  let importEntries: ReturnType<typeof vi.fn<ImportEntries>>;
  let uploadAttachments: ReturnType<typeof vi.fn<UploadAttachments>>;
  let service: AppImportService;
  const onProgress = vi.fn();

  const media = (name: string, mimetype = 'image/jpeg', convert = false): ImportedMedia => ({ name, mimetype, convert, file: files.get(name)! });
  const entry = (sourceId: string, overrides: Partial<ImportedEntry> = {}): ImportedEntry => ({
    sourceId,
    date: '2024-03-05',
    timestamp: 0,
    content: `Entry ${sourceId}`,
    tags: [],
    favorite: false,
    journal: 'Journal',
    media: [],
    ...overrides,
  });
  const exportOf = (entries: ImportedEntry[]): AppExport => ({ source: 'dayone', archive, entries, journals: ['Journal'], skippedMedia: 0 });

  /** Answers every batch as newly imported, numbering entries from 100. */
  const acceptEntries = () => {
    let nextId = 100;
    importEntries.mockImplementation(async (request) => ok({
      entries: request.entries.map((item) => ({ sourceId: item.sourceId, entryId: nextId++, alreadyImported: false, attachedFiles: [] })),
      importedCount: request.entries.length,
      alreadyImportedCount: 0,
      createdDiaries: [],
    }));
  };

  beforeEach(async () => {
    vi.useRealTimers();
    archive = new Blob([await buildZip([
      { name: 'a.jpeg', data: new Uint8Array(1000).fill(1), store: true },
      { name: 'b.jpeg', data: new Uint8Array(1000).fill(2), store: true },
      { name: 'voice.m4a', data: new Uint8Array(500).fill(3), store: true },
      { name: 'big.jpeg', data: new Uint8Array(6 * 1024 * 1024).fill(4), store: true },
      { name: 'big.m4a', data: new Uint8Array(6 * 1024 * 1024).fill(5), store: true },
      { name: 'c.heic', data: new Uint8Array(100).fill(6), store: true },
    ]) as BlobPart]);
    files = new Map((await readZipEntries(archive)).map((file) => [file.name, file]));
    importEntries = vi.fn<ImportEntries>();
    uploadAttachments = vi.fn<UploadAttachments>(async (uploads, entryIds) => ok({
      attachments: uploads.map((upload, index) => ({ id: index + 1, entryId: entryIds[index]!, originalFilename: upload.name })),
    }));
    service = { importEntries, uploadAttachments };
    onProgress.mockClear();
    vi.mocked(shrinkPhoto).mockReset();
  });

  it('imports entries, then uploads their files to the entries the server created', async () => {
    acceptEntries();

    const summary = await runAppImport(
      exportOf([entry('A', { media: [media('a.jpeg'), media('voice.m4a', 'audio/mp4')], favorite: true, tags: ['sea'] }), entry('B', { media: [media('b.jpeg')] })]),
      { diaryId: 4, journalsAsDiaries: false },
      service,
      onProgress,
      new AbortController().signal,
    );

    expect(importEntries).toHaveBeenCalledWith({
      source: 'dayone',
      diaryId: 4,
      journalsAsDiaries: false,
      entries: [
        { sourceId: 'A', date: '2024-03-05', content: 'Entry A', tags: ['sea'], favorite: true },
        { sourceId: 'B', date: '2024-03-05', content: 'Entry B', tags: [], favorite: false },
      ],
    });
    expect(uploadAttachments).toHaveBeenCalledTimes(1);
    const [uploads, entryIds] = uploadAttachments.mock.calls[0]!;
    expect(uploads.map((upload) => [upload.name, upload.type, upload.size])).toEqual([
      ['a.jpeg', 'image/jpeg', 1000],
      ['voice.m4a', 'audio/mp4', 500],
      ['b.jpeg', 'image/jpeg', 1000],
    ]);
    expect(entryIds).toEqual([100, 100, 101]);
    expect(summary).toEqual({ imported: 2, alreadyImported: 0, attached: 3, failedFiles: [], createdDiaries: [], stopped: false });
    expect(onProgress).toHaveBeenLastCalledWith({ phase: 'files', done: 3, total: 3 });
  });

  it('sends the title and time of day only when the entry has them', async () => {
    acceptEntries();

    await runAppImport(
      exportOf([entry('A', { title: 'Harbour', timeOfDay: '07:45' }), entry('B')]),
      { diaryId: 4, journalsAsDiaries: false },
      service,
      onProgress,
      new AbortController().signal,
    );

    expect(importEntries.mock.calls[0]![0].entries).toEqual([
      { sourceId: 'A', date: '2024-03-05', timeOfDay: '07:45', title: 'Harbour', content: 'Entry A', tags: [], favorite: false },
      { sourceId: 'B', date: '2024-03-05', content: 'Entry B', tags: [], favorite: false },
    ]);
  });

  it('sends journal names only when journals become diaries', async () => {
    acceptEntries();

    await runAppImport(exportOf([entry('A', { journal: 'Travel' })]), { journalsAsDiaries: true }, service, onProgress, new AbortController().signal);

    expect(importEntries.mock.calls[0]![0]).toEqual(expect.objectContaining({ journalsAsDiaries: true, entries: [expect.objectContaining({ journal: 'Travel' })] }));
    expect(importEntries.mock.calls[0]![0]).not.toHaveProperty('diaryId');
  });

  it('does not send files an earlier run already attached', async () => {
    importEntries.mockResolvedValue(ok({
      entries: [{ sourceId: 'A', entryId: 40, alreadyImported: true, attachedFiles: ['a.jpeg', 'c.jpg'] }],
      importedCount: 0,
      alreadyImportedCount: 1,
      createdDiaries: [],
    }));
    vi.mocked(shrinkPhoto).mockResolvedValue(new Blob(['jpeg']));

    const summary = await runAppImport(
      exportOf([entry('A', { media: [media('a.jpeg'), media('b.jpeg'), media('c.heic', 'image/jpeg', true)] })]),
      { journalsAsDiaries: false },
      service,
      onProgress,
      new AbortController().signal,
    );

    expect(uploadAttachments.mock.calls[0]![0].map((upload) => upload.name)).toEqual(['b.jpeg']);
    expect(summary.alreadyImported).toBe(1);
  });

  it('batches entries by count and splits entries longer than the server allows', async () => {
    acceptEntries();
    const entries = Array.from({ length: 450 }, (_, index) => entry(`E${index}`));
    entries[0] = entry('LONG', { content: `${'a'.repeat(40_000)}\n\n${'b'.repeat(40_000)}` });

    const summary = await runAppImport(exportOf(entries), { journalsAsDiaries: false }, service, onProgress, new AbortController().signal);

    expect(importEntries.mock.calls.map(([request]) => request.entries.length)).toEqual([200, 200, 51]);
    const [first, second] = importEntries.mock.calls[0]![0].entries;
    expect([first!.sourceId, first!.content.length, second!.sourceId, second!.content.length]).toEqual(['LONG', 40_000, 'LONG.part2', 40_000]);
    expect(summary.imported).toBe(451);
  });

  it('shrinks large photos and converts unsupported formats, and reports files it cannot attach', async () => {
    acceptEntries();
    vi.mocked(shrinkPhoto).mockImplementation(async (photo) => (photo.size > 1000 ? new Blob(['small jpeg']) : null));

    const summary = await runAppImport(
      exportOf([entry('A', { media: [media('big.jpeg'), media('big.m4a', 'audio/mp4'), media('c.heic', 'image/jpeg', true)] })]),
      { journalsAsDiaries: false },
      service,
      onProgress,
      new AbortController().signal,
    );

    expect(uploadAttachments.mock.calls[0]![0].map((upload) => [upload.name, upload.type, upload.size])).toEqual([['big.jpeg', 'image/jpeg', 10]]);
    expect(summary.failedFiles).toEqual([
      { name: 'big.m4a', reason: 'tooLarge' },
      { name: 'c.heic', reason: 'unreadable' },
    ]);
  });

  it('packs at most eight files per upload', async () => {
    acceptEntries();
    const many = Array.from({ length: 10 }, () => media('a.jpeg'));

    await runAppImport(exportOf([entry('A', { media: many })]), { journalsAsDiaries: false }, service, onProgress, new AbortController().signal);

    expect(uploadAttachments.mock.calls.map(([uploads]) => uploads.length)).toEqual([8, 2]);
  });

  it('finds the file the server refuses by retrying the pack one file at a time', async () => {
    acceptEntries();
    uploadAttachments.mockImplementation(async (uploads, entryIds) => (
      uploads.some((upload) => upload.name === 'voice.m4a')
        ? failure(400)
        : ok({ attachments: uploads.map((upload, index) => ({ id: index, entryId: entryIds[index]!, originalFilename: upload.name })) })
    ));

    const summary = await runAppImport(
      exportOf([entry('A', { media: [media('a.jpeg'), media('voice.m4a', 'audio/mp4')] })]),
      { journalsAsDiaries: false },
      service,
      onProgress,
      new AbortController().signal,
    );

    expect(uploadAttachments).toHaveBeenCalledTimes(3);
    expect(summary.attached).toBe(1);
    expect(summary.failedFiles).toEqual([{ name: 'voice.m4a', reason: 'rejected' }]);
  });

  it('waits when the server asks it to slow down, then carries on', async () => {
    vi.useFakeTimers();
    acceptEntries();
    const accept = importEntries.getMockImplementation()!;
    importEntries.mockImplementationOnce(async () => failure(429, 3)).mockImplementation(accept);

    const run = runAppImport(exportOf([entry('A')]), { journalsAsDiaries: false }, service, onProgress, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(3000);
    const summary = await run;

    expect(onProgress).toHaveBeenCalledWith({ phase: 'entries', done: 0, total: 1, waitingSeconds: 3 });
    expect(importEntries).toHaveBeenCalledTimes(2);
    expect(summary.imported).toBe(1);
  });

  it('retries network errors a few times before giving up', async () => {
    vi.useFakeTimers();
    importEntries.mockResolvedValue(failure(0));

    const run = runAppImport(exportOf([entry('A')]), { journalsAsDiaries: false }, service, onProgress, new AbortController().signal);
    const outcome = expect(run).rejects.toBeInstanceOf(AppImportError);
    await vi.advanceTimersByTimeAsync(30_000);
    await outcome;

    expect(importEntries).toHaveBeenCalledTimes(4);
  });

  it('stops when asked and reports how far it got', async () => {
    const controller = new AbortController();
    acceptEntries();
    const accept = importEntries.getMockImplementation()!;
    importEntries.mockImplementation(async (request) => {
      controller.abort();
      return accept(request);
    });

    const summary = await runAppImport(
      exportOf(Array.from({ length: 250 }, (_, index) => entry(`E${index}`, { media: [media('a.jpeg')] }))),
      { journalsAsDiaries: false },
      service,
      onProgress,
      controller.signal,
    );

    expect(importEntries).toHaveBeenCalledTimes(1);
    expect(uploadAttachments).not.toHaveBeenCalled();
    expect(summary).toEqual(expect.objectContaining({ imported: 200, stopped: true }));
  });

  it('fails with the server’s message when a batch is refused', async () => {
    importEntries.mockResolvedValue(failure(400));

    await expect(
      runAppImport(exportOf([entry('A')]), { journalsAsDiaries: false }, service, onProgress, new AbortController().signal),
    ).rejects.toThrow('HTTP 400');
  });

  it('skips the upload step for a JSON export without media', async () => {
    acceptEntries();

    await runAppImport({ ...exportOf([entry('A')]), archive: null }, { journalsAsDiaries: false }, service, onProgress, new AbortController().signal);

    expect(uploadAttachments).not.toHaveBeenCalled();
  });
});

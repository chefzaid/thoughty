// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { buildZip, type ZipFixtureFile } from '../../../test/zipFixture';
import { readAppExport, UnsupportedExportError } from './readAppExport';
import { dailyNoteSourceId, ExportTooLargeError, MAX_DAILY_NOTE_BYTES, NoDailyNotesError } from './readDailyNotes';

async function zipFile(files: ZipFixtureFile[]): Promise<File> {
  return new File([await buildZip(files) as BlobPart], 'notes.zip', { type: 'application/zip' });
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('readAppExport with daily notes', () => {
  it('reads Obsidian and Logseq daily notes at any depth, oldest first, with the files they embed', async () => {
    const file = await zipFile([
      { name: 'Vault/Daily/2024-03-14.md', data: '---\ntags: [journal]\n---\nRain. #weather\n\n![[pier.png]]' },
      { name: 'Vault/journals/2024_03_13.md', data: '- Standup\n- ![shot](../assets/shot_1.png)\n- [[2024_03_12]]' },
      { name: 'Vault/Daily/Archive/2023/2023-12-31.md', data: 'Last day of the year' },
      { name: 'Vault/attachments/pier.png', data: png, store: true },
      { name: 'Vault/assets/shot_1.png', data: png, store: true },
      { name: 'Vault/Ideas.md', data: 'Not a daily note' },
      { name: 'Vault/Daily/2023-02-29.md', data: 'No such day' },
      { name: 'Vault/Daily/2024-03-15.md', data: '' },
      { name: 'Vault/journals/2024_03_16.md', data: '-\n' },
      { name: 'Vault/Daily/2024-03-17.md', data: 'x', declaredSize: MAX_DAILY_NOTE_BYTES + 1 },
      { name: 'Vault/Daily/2024-03-18.md', data: '/etc/passwd', symlink: true },
      { name: 'ignored', nameBytes: new Uint8Array([0x32, 0x30, 0x32, 0x34, 0x2d, 0x30, 0x33, 0x2d, 0x31, 0x39, 0xe9, 0x2e, 0x6d, 0x64]), data: 'é' },
      { name: '../2024-03-20.md', data: 'Outside the archive' },
      { name: 'Vault/.trash/2024-03-21.md', data: 'Deleted in Obsidian' },
      { name: '__MACOSX/Vault/._2024-03-14.md', data: 'Finder data' },
    ]);

    const result = await readAppExport(file, 'daily-notes');

    expect(result).toEqual(expect.objectContaining({ source: 'daily-notes', archive: file, journals: [], skippedMedia: 0 }));
    expect(result.skippedNotes).toEqual({ undated: 2, empty: 2, tooLarge: 1, unsafe: 3 });
    expect(result.entries.map(({ sourceId, date, content, tags, journal, favorite }) => ({ sourceId, date, content, tags, journal, favorite }))).toEqual([
      {
        sourceId: 'Vault/Daily/Archive/2023/2023-12-31.md',
        date: '2023-12-31',
        content: 'Last day of the year',
        tags: [],
        journal: '',
        favorite: false,
      },
      {
        sourceId: 'Vault/journals/2024_03_13.md',
        date: '2024-03-13',
        content: '- Standup\n- ![shot](attachment:shot_1.png)\n- [[2024-03-12]]',
        tags: [],
        journal: '',
        favorite: false,
      },
      {
        sourceId: 'Vault/Daily/2024-03-14.md',
        date: '2024-03-14',
        content: 'Rain. #weather\n\n![pier.png](attachment:pier.png)',
        tags: ['journal', 'weather'],
        journal: '',
        favorite: false,
      },
    ]);
    expect(result.entries.map((entry) => entry.media.map((media) => media.file.name))).toEqual([
      [],
      ['Vault/assets/shot_1.png'],
      ['Vault/attachments/pier.png'],
    ]);
  });

  it('keeps the same source ID for a note each time, hashing paths the API would not take', async () => {
    expect(dailyNoteSourceId('journals/2024_03_14.md', '2024-03-14')).toBe('journals/2024_03_14.md');
    const spaced = dailyNoteSourceId('Daily Notes/2024-03-14.md', '2024-03-14');
    expect(spaced).toMatch(/^2024-03-14\.[0-9a-f]{16}$/);
    expect(dailyNoteSourceId('Daily Notes/2024-03-14.md', '2024-03-14')).toBe(spaced);
    expect(dailyNoteSourceId('Notes du jour/2024-03-14.md', '2024-03-14')).not.toBe(spaced);
    expect(dailyNoteSourceId(`${'a'.repeat(90)}/2024-03-14.md`, '2024-03-14')).toMatch(/^2024-03-14\.[0-9a-f]{16}$/);

    const file = await zipFile([{ name: 'Journal quotidien/Été/2024-07-01.md', data: 'Plage' }]);
    const [first] = (await readAppExport(file, 'daily-notes')).entries;
    const [again] = (await readAppExport(file, 'daily-notes')).entries;
    expect(first!.sourceId).toBe(again!.sourceId);
    expect(first!.sourceId).toMatch(/^2024-07-01\.[0-9a-f]{16}$/);
  });

  it('counts embedded files that are missing, unsafe or of another type', async () => {
    const file = await zipFile([
      { name: '2024-03-14.md', data: '![[gone.png]] ![[link.png]] ![[drawing.png]] ![](notes.psd)' },
      { name: 'link.png', data: '/etc/passwd', symlink: true },
      { name: 'img/drawing.png', data: png, store: true },
      { name: 'notes.psd', data: 'psd' },
    ]);

    const [entry] = (await readAppExport(file, 'daily-notes')).entries;

    expect(entry!.content).toBe('gone.png link.png ![drawing.png](attachment:drawing.png) notes.psd');
    expect(entry!.media.map((media) => media.name)).toEqual(['drawing.png']);
    expect((await readAppExport(file, 'daily-notes')).skippedMedia).toBe(3);
  });

  it('says when no note is named by a day, or the file is not a ZIP', async () => {
    await expect(readAppExport(await zipFile([{ name: 'Ideas.md', data: 'x' }, { name: '14-03-2024.md', data: 'x' }]), 'daily-notes'))
      .rejects.toBeInstanceOf(NoDailyNotesError);
    await expect(readAppExport(new File(['# 2024-03-14'], '2024-03-14.md'), 'daily-notes')).rejects.toBeInstanceOf(NoDailyNotesError);
  });

  it('lists an archive of empty daily notes with nothing to import', async () => {
    const result = await readAppExport(await zipFile([{ name: '2024-03-14.md', data: '' }]), 'daily-notes');

    expect(result.entries).toEqual([]);
    expect(result.skippedNotes).toEqual({ undated: 0, empty: 1, tooLarge: 0, unsafe: 0 });
  });

  it('refuses notes that would unpack to more than the import reads at once', async () => {
    const notes = Array.from({ length: 41 }, (_, day) => ({
      name: `2024-01-${String(day % 28 + 1).padStart(2, '0')}-${day}/2024-01-${String(day % 28 + 1).padStart(2, '0')}.md`,
      data: 'x',
      declaredSize: MAX_DAILY_NOTE_BYTES,
    }));

    await expect(readAppExport(await zipFile(notes), 'daily-notes')).rejects.toBeInstanceOf(ExportTooLargeError);
  });

  it('refuses a note that unpacks to more than the archive says', async () => {
    const file = await zipFile([{ name: '2024-03-14.md', data: 'x'.repeat(50_000), declaredSize: 100 }]);

    await expect(readAppExport(file, 'daily-notes')).rejects.toBeInstanceOf(UnsupportedExportError);
  });
});

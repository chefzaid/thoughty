// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { buildZip, type ZipFixtureFile } from '../../../test/zipFixture';
import { ExportTooLargeError, MAX_NOTE_BYTES } from './appImportArchive';
import { readAppExport, UnsupportedExportError } from './readAppExport';
import { NoKeepNotesError } from './readKeep';

vi.mock('../../../utils/timeZone', () => ({ browserTimeZone: () => 'UTC' }));

async function zipFile(files: ZipFixtureFile[]): Promise<File> {
  return new File([await buildZip(files) as BlobPart], 'takeout-20261101T120000Z-001.zip', { type: 'application/zip' });
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const usec = (iso: string) => Date.parse(iso) * 1000;
const note = (fields: Record<string, unknown>) => JSON.stringify({ color: 'DEFAULT', isTrashed: false, isPinned: false, isArchived: false, ...fields });

describe('readAppExport with Google Keep', () => {
  it('reads each note of a Takeout from its JSON file, oldest first, with its pictures, and counts the notes left out', async () => {
    const file = await zipFile([
      { name: 'Takeout/archive_browser.html', data: '<html></html>' },
      { name: 'Takeout/Keep/Labels.txt', data: 'Shopping\nTravel plans' },
      {
        name: 'Takeout/Keep/Groceries.json',
        data: note({
          title: 'Groceries',
          listContent: [{ text: 'Milk', isChecked: false }, { text: 'Bread', isChecked: true }],
          labels: [{ name: 'Shopping' }],
          isPinned: true,
          createdTimestampUsec: usec('2024-03-14T09:00:00Z'),
          userEditedTimestampUsec: usec('2024-03-20T09:00:00Z'),
        }),
      },
      { name: 'Takeout/Keep/Groceries.html', data: '<html>Groceries</html>' },
      {
        name: 'Takeout/Keep/Trip ideas.json',
        data: note({
          title: 'Trip ideas',
          textContent: 'Lisbon in spring',
          labels: [{ name: 'Travel plans' }],
          attachments: [{ filePath: '17a2b3c4d5e.6f7a8b9c.jpeg', mimetype: 'image/jpeg' }],
          isArchived: true,
          createdTimestampUsec: usec('2023-06-01T18:45:00Z'),
        }),
      },
      { name: 'Takeout/Keep/17a2b3c4d5e.6f7a8b9c.jpg', data: jpeg, store: true },
      { name: 'Takeout/Keep/Old.json', data: note({ textContent: 'Binned', isTrashed: true, createdTimestampUsec: usec('2022-01-01T00:00:00Z') }) },
      { name: 'Takeout/Keep/Blank.json', data: note({ textContent: '', createdTimestampUsec: usec('2022-01-02T00:00:00Z') }) },
      { name: 'Takeout/Keep/Undated.json', data: note({ textContent: 'When?' }) },
      { name: 'Takeout/Keep/Broken.json', data: '{"textContent": ' },
      { name: 'Takeout/Keep/Huge.json', data: '{}', declaredSize: MAX_NOTE_BYTES + 1 },
      { name: 'Takeout/Keep/Link.json', data: '/etc/passwd', symlink: true },
      { name: 'Takeout/Keep/.hidden.json', data: note({ textContent: 'Hidden', createdTimestampUsec: 1 }) },
      { name: 'Takeout/Drive/settings.json', data: '{"textContent": "not Keep", "createdTimestampUsec": 1}' },
    ]);

    const result = await readAppExport(file, 'keep');

    expect(result).toEqual(expect.objectContaining({ source: 'keep', archive: file, journals: [], skippedMedia: 0 }));
    expect(result.skippedNotes).toEqual({ trashed: 1, noDate: 1, empty: 1, tooLarge: 1, unsafe: 1, unreadable: 1 });
    expect(result.entries.map(({ sourceId, date, timeOfDay, title, content, tags, archived, pinned }) => ({ sourceId, date, timeOfDay, title, content, tags, archived, pinned })))
      .toEqual([
        {
          sourceId: expect.stringMatching(/^2023-06-01\.[0-9a-f]{16}$/),
          date: '2023-06-01',
          timeOfDay: '18:45',
          title: 'Trip ideas',
          content: '![](attachment:17a2b3c4d5e.6f7a8b9c.jpg)\n\nLisbon in spring',
          tags: ['Travel plans'],
          archived: true,
          pinned: undefined,
        },
        {
          sourceId: 'Groceries',
          date: '2024-03-14',
          timeOfDay: '09:00',
          title: 'Groceries',
          content: '- [ ] Milk\n- [x] Bread',
          tags: ['Shopping'],
          archived: undefined,
          pinned: true,
        },
      ]);
    expect(result.entries[0]!.media.map((media) => [media.name, media.file.name, media.mimetype])).toEqual([
      ['17a2b3c4d5e.6f7a8b9c.jpg', 'Takeout/Keep/17a2b3c4d5e.6f7a8b9c.jpg', 'image/jpeg'],
    ]);
  });

  it('reads a ZIP of the Keep folder\'s files alone, and a picture from another note\'s folder is not this note\'s', async () => {
    const file = await zipFile([
      { name: 'Walk.json', data: note({ textContent: 'Walk', attachments: [{ filePath: 'pier.jpg' }], createdTimestampUsec: usec('2024-05-01T07:00:00Z') }) },
      { name: 'Other/pier.jpg', data: jpeg, store: true },
    ]);

    const result = await readAppExport(file, 'keep');

    expect(result.entries.map((entry) => [entry.sourceId, entry.content, entry.media.length])).toEqual([['Walk', 'Walk', 0]]);
    expect(result.skippedMedia).toBe(1);
  });

  it('lists a Takeout whose notes are all in the bin, with nothing to import', async () => {
    const result = await readAppExport(await zipFile([{ name: 'Takeout/Keep/a.json', data: note({ isTrashed: true }) }]), 'keep');

    expect(result.entries).toEqual([]);
    expect(result.skippedNotes).toEqual(expect.objectContaining({ trashed: 1 }));
  });

  it('finds no Keep notes in another archive or in a file that is not a ZIP', async () => {
    await expect(readAppExport(await zipFile([{ name: 'Takeout/Drive/notes.txt', data: 'x' }]), 'keep')).rejects.toBeInstanceOf(NoKeepNotesError);
    await expect(readAppExport(await zipFile([{ name: 'journal.json', data: '{"entries": []}' }]), 'keep')).rejects.toBeInstanceOf(NoKeepNotesError);
    await expect(readAppExport(await zipFile([{ name: '../Keep/a.json', data: note({ textContent: 'x', createdTimestampUsec: 1 }) }]), 'keep'))
      .rejects.toThrow('1 unsafe files');
    await expect(readAppExport(new File([note({ textContent: 'x' })], 'a.json'), 'keep')).rejects.toBeInstanceOf(NoKeepNotesError);
  });

  it('refuses notes that would unpack to more than the import reads at once, and a damaged ZIP', async () => {
    const notes = Array.from({ length: 41 }, (_, index) => ({ name: `Takeout/Keep/n${index}.json`, data: '{}', declaredSize: MAX_NOTE_BYTES }));
    await expect(readAppExport(await zipFile(notes), 'keep')).rejects.toBeInstanceOf(ExportTooLargeError);

    const damaged = await zipFile([{ name: 'Takeout/Keep/a.json', data: 'x'.repeat(50_000), declaredSize: 100 }]);
    await expect(readAppExport(damaged, 'keep')).rejects.toBeInstanceOf(UnsupportedExportError);
  });
});

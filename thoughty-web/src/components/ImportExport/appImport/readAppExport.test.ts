// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { buildZip, type ZipFixtureFile } from '../../../test/zipFixture';
import { readAppExport, UnsupportedExportError } from './readAppExport';

async function zipFile(files: ZipFixtureFile[], name = 'export.zip'): Promise<File> {
  return new File([await buildZip(files) as BlobPart], name, { type: 'application/zip' });
}

const dayOneJournal = (entries: object[]) => JSON.stringify({ metadata: { version: '1.0' }, entries });

describe('readAppExport', () => {
  it('reads every journal of a Day One export with its photos, oldest entry first', async () => {
    const file = await zipFile([
      { name: 'Journal.json', data: dayOneJournal([{ uuid: 'B', creationDate: '2022-06-01T10:00:00Z', text: 'Second', photos: [{ md5: '5f2b' }] }]) },
      { name: 'Travel.json', data: dayOneJournal([{ uuid: 'A', creationDate: '2021-01-01T10:00:00Z', text: 'First', videos: [{ md5: '99dd' }] }]) },
      { name: 'photos/5f2b.jpeg', data: new Uint8Array([1, 2, 3]), store: true },
      { name: 'videos/99dd.mov', data: new Uint8Array([4]), store: true },
      { name: '__MACOSX/._Journal.json', data: 'ignored' },
    ]);

    const result = await readAppExport(file);

    expect(result.source).toBe('dayone');
    expect(result.archive).toBe(file);
    expect(result.journals).toEqual(['Journal', 'Travel']);
    expect(result.entries.map((entry) => [entry.sourceId, entry.journal, entry.media.map((media) => media.name)])).toEqual([
      ['A', 'Travel', ['99dd.mov']],
      ['B', 'Journal', ['5f2b.jpeg']],
    ]);
    expect(result.skippedMedia).toBe(0);
  });

  it('reads a Journey export with one JSON file per entry', async () => {
    const file = await zipFile([
      { name: '1600000000000-b.json', data: JSON.stringify({ id: '1600000000000-b', date_journal: 1_600_000_000_000, text: 'Later', photos: ['1600000000000-b-p.jpg'] }) },
      { name: '1500000000000-a.json', data: JSON.stringify({ id: '1500000000000-a', date_journal: 1_500_000_000_000, text: 'Earlier', type: 'markdown' }) },
      { name: '1600000000000-b-p.jpg', data: new Uint8Array([1]), store: true },
      { name: 'notes.json', data: '{"unrelated":true}' },
    ]);

    const result = await readAppExport(file);

    expect(result.source).toBe('journey');
    expect(result.journals).toEqual(['Journey']);
    expect(result.entries.map((entry) => [entry.content, entry.media.length])).toEqual([
      ['Earlier', 0],
      ['Later', 1],
    ]);
  });

  it('reads a Day One JSON file on its own, without media', async () => {
    const file = new File([dayOneJournal([{ uuid: 'A', creationDate: '2021-01-01T10:00:00Z', text: 'Hi', photos: [{ md5: '5f2b' }] }])], 'Dreams.json');

    const result = await readAppExport(file);

    expect(result).toEqual(expect.objectContaining({ source: 'dayone', archive: null, journals: ['Dreams'], skippedMedia: 1 }));
    expect(result.entries).toHaveLength(1);
  });

  it('refuses archives and files from other apps', async () => {
    await expect(readAppExport(await zipFile([{ name: 'notes.txt', data: 'hello' }]))).rejects.toBeInstanceOf(UnsupportedExportError);
    await expect(readAppExport(await zipFile([{ name: 'data.json', data: '{"a":1}' }]))).rejects.toBeInstanceOf(UnsupportedExportError);
    await expect(readAppExport(new File(['PK but not a zip'], 'broken.zip'))).rejects.toBeInstanceOf(UnsupportedExportError);
    await expect(readAppExport(new File(['plain text'], 'notes.txt'))).rejects.toBeInstanceOf(UnsupportedExportError);
  });
});

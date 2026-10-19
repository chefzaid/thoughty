// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { buildZip } from '../test/zipFixture';
import { readZipEntries, readZipFile, readZipText, ZipFormatError } from './zipReader';

const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const journal = JSON.stringify({ entries: [{ text: 'Été à la mer' }] });

describe('zipReader', () => {
  it('lists files and extracts deflated and stored ones', async () => {
    const archive = new Blob([await buildZip([
      { name: 'Journal.json', data: journal },
      { name: 'photos/5f2b.jpeg', data: photo, store: true },
    ]) as BlobPart]);

    const entries = await readZipEntries(archive);

    expect(entries.map(({ name, size, method }) => ({ name, size, method }))).toEqual([
      { name: 'Journal.json', size: new TextEncoder().encode(journal).length, method: 8 },
      { name: 'photos/5f2b.jpeg', size: photo.length, method: 0 },
    ]);
    await expect(readZipText(archive, entries[0]!)).resolves.toBe(journal);
    const extracted = await readZipFile(archive, entries[1]!, 'image/jpeg');
    expect(extracted.type).toBe('image/jpeg');
    expect(new Uint8Array(await extracted.arrayBuffer())).toEqual(photo);
  });

  it('labels deflated files with the requested type', async () => {
    const archive = new Blob([await buildZip([{ name: 'a.json', data: '{}' }]) as BlobPart]);
    const [entry] = await readZipEntries(archive);

    const extracted = await readZipFile(archive, entry!, 'application/json');

    expect(extracted.type).toBe('application/json');
    await expect(extracted.text()).resolves.toBe('{}');
  });

  it('reads ZIP64 archives', async () => {
    const archive = new Blob([await buildZip([
      { name: 'one.json', data: '{"n":1}' },
      { name: 'two.json', data: '{"n":2}' },
    ], { zip64: true }) as BlobPart]);

    const entries = await readZipEntries(archive);

    expect(entries.map((entry) => entry.name)).toEqual(['one.json', 'two.json']);
    await expect(readZipText(archive, entries[1]!)).resolves.toBe('{"n":2}');
  });

  it('skips folders', async () => {
    const archive = new Blob([await buildZip([
      { name: 'Journey/', data: '', store: true },
      { name: 'Journey/1.json', data: '{}' },
    ]) as BlobPart]);

    await expect(readZipEntries(archive)).resolves.toHaveLength(1);
  });

  it('rejects files that are not ZIP archives', async () => {
    await expect(readZipEntries(new Blob(['just text']))).rejects.toBeInstanceOf(ZipFormatError);
  });

  it('refuses encrypted files and unknown compression methods', async () => {
    const archive = new Blob([await buildZip([{ name: 'a.json', data: '{}' }]) as BlobPart]);
    const [entry] = await readZipEntries(archive);

    await expect(readZipFile(archive, { ...entry!, encrypted: true })).rejects.toThrow('encrypted');
    await expect(readZipFile(archive, { ...entry!, method: 12 })).rejects.toThrow('unsupported compression');
    await expect(readZipFile(archive, { ...entry!, localHeaderOffset: 5 })).rejects.toThrow('Damaged');
  });
});

import JSZip from 'jszip';
import { ZipWriter, type ZipWriterOptions } from './zip-writer.util';

async function buildArchive(
  files: Array<{ name: string; data: Buffer | string; compress?: boolean }>,
  options?: ZipWriterOptions,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const writer = new ZipWriter(async (chunk) => {
    chunks.push(chunk);
  }, options);
  for (const file of files) {
    await writer.addFile(file.name, file.data, { compress: file.compress });
  }
  await writer.finish();
  return Buffer.concat(chunks);
}

describe('ZipWriter', () => {
  const photo = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);

  it('writes an archive that standard readers open with valid checksums', async () => {
    const text = '# 2024-03-05\n\n' + 'A long day by the sea. '.repeat(50);
    const archive = await buildArchive([
      { name: 'Travel/2024/2024-03-05.md', data: text },
      { name: 'Travel/2024/attachments/2024-03-05-beach.jpg', data: photo, compress: false },
      { name: 'Journal/2023/Été à Noël.md', data: 'Accents survive' },
    ]);

    const zip = await JSZip.loadAsync(archive, { checkCRC32: true });

    expect(Object.keys(zip.files).sort()).toEqual([
      'Journal/2023/Été à Noël.md',
      'Travel/2024/2024-03-05.md',
      'Travel/2024/attachments/2024-03-05-beach.jpg',
    ]);
    await expect(zip.file('Travel/2024/2024-03-05.md')!.async('string')).resolves.toBe(text);
    await expect(zip.file('Travel/2024/attachments/2024-03-05-beach.jpg')!.async('nodebuffer')).resolves.toEqual(photo);
    await expect(zip.file('Journal/2023/Été à Noël.md')!.async('string')).resolves.toBe('Accents survive');
  });

  it('compresses text and stores data that would not shrink', async () => {
    const text = 'repeat '.repeat(1000);
    const archive = await buildArchive([
      { name: 'a.md', data: text },
      { name: 'b.bin', data: photo },
    ]);

    expect(archive.length).toBeLessThan(text.length);
    const methods: number[] = [];
    for (let offset = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); offset >= 0; offset = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), offset + 4)) {
      methods.push(archive.readUInt16LE(offset + 10));
    }
    expect(methods).toEqual([8, 0]);
  });

  it('stamps every file with the export time', async () => {
    const archive = await buildArchive([{ name: 'a.md', data: 'x' }], {
      modifiedAt: new Date('2026-10-19T14:30:10Z'),
    });

    const zip = await JSZip.loadAsync(archive);
    const date = zip.file('a.md')!.date;
    expect([date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()]).toEqual([2026, 9, 19]);
  });

  it('switches to ZIP64 records once offsets pass the limit', async () => {
    const archive = await buildArchive(
      [
        { name: 'first.md', data: 'first entry' },
        { name: 'second.md', data: 'second entry' },
      ],
      { zip64Offset: 10 },
    );

    expect(archive.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06]))).toBe(true);
    expect(archive.includes(Buffer.from([0x50, 0x4b, 0x06, 0x07]))).toBe(true);
    const zip = await JSZip.loadAsync(archive, { checkCRC32: true });
    await expect(zip.file('second.md')!.async('string')).resolves.toBe('second entry');
    await expect(zip.file('first.md')!.async('string')).resolves.toBe('first entry');
  });

  it('counts the files written so far', async () => {
    const writer = new ZipWriter(async () => undefined);
    await writer.addFile('a.md', 'a');
    await writer.addFile('b.md', 'b');

    expect(writer.fileCount).toBe(2);
  });

  it('stops when the sink fails, for example after the download is cancelled', async () => {
    const writer = new ZipWriter(async () => {
      throw new Error('aborted');
    });

    await expect(writer.addFile('a.md', 'a')).rejects.toThrow('aborted');
  });
});

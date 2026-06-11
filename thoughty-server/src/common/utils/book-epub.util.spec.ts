import JSZip from 'jszip';
import { renderBookEpub } from './book-epub.util';
import { Book } from './book-converter.util';

async function readZipEntry(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`Missing zip entry: ${path}`);
  }
  return file.async('string');
}

describe('renderBookEpub', () => {
  const book: Book = {
    title: 'My Book',
    author: 'Jane',
    generatedAt: '2024-06-01',
    chapters: [
      {
        title: 'Travel',
        entries: [
          { date: '2024-01-10', index: 1, tags: ['travel'], content: 'Pasta in Naples', format: 'plain' },
        ],
      },
      {
        title: 'Food & Drink',
        entries: [
          { date: '2024-02-01', index: 1, tags: ['food'], content: '<b>Cooking</b> at home', format: 'plain' },
        ],
      },
    ],
  };

  it('should produce a zip with the uncompressed mimetype entry first', async () => {
    const buffer = await renderBookEpub(book);

    // Zip local file header magic
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    // Per the EPUB spec the mimetype string must appear at offset 38 of the file
    expect(buffer.subarray(38, 38 + 20).toString()).toBe('application/epub+zip');
  });

  it('should contain the required EPUB structure and chapters', async () => {
    const buffer = await renderBookEpub(book);
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file('META-INF/container.xml')).toBeTruthy();
    expect(zip.file('OEBPS/content.opf')).toBeTruthy();
    expect(zip.file('OEBPS/nav.xhtml')).toBeTruthy();
    expect(zip.file('OEBPS/title.xhtml')).toBeTruthy();
    expect(zip.file('OEBPS/chapter-1.xhtml')).toBeTruthy();
    expect(zip.file('OEBPS/chapter-2.xhtml')).toBeTruthy();

    const opf = await readZipEntry(zip, 'OEBPS/content.opf');
    expect(opf).toContain('<dc:title>My Book</dc:title>');
    expect(opf).toContain('<dc:creator>Jane</dc:creator>');

    const nav = await readZipEntry(zip, 'OEBPS/nav.xhtml');
    expect(nav).toContain('Food &amp; Drink');
  });

  it('should escape entry content in chapter pages', async () => {
    const buffer = await renderBookEpub(book);
    const zip = await JSZip.loadAsync(buffer);
    const chapter2 = await readZipEntry(zip, 'OEBPS/chapter-2.xhtml');

    expect(chapter2).toContain('&lt;b&gt;Cooking&lt;/b&gt; at home');
    expect(chapter2).not.toContain('<b>Cooking</b>');
  });

  it('should hide the nav when the table of contents is disabled', async () => {
    const buffer = await renderBookEpub(book, { includeToc: false });
    const zip = await JSZip.loadAsync(buffer);
    const nav = await readZipEntry(zip, 'OEBPS/nav.xhtml');

    expect(nav).toContain('hidden=""');
  });

  it('should render the chapter narrative instead of entries when present', async () => {
    const narrativeBook: Book = {
      ...book,
      chapters: [
        { ...book.chapters[0], narrative: 'A woven story about travel.' },
      ],
    };
    const buffer = await renderBookEpub(narrativeBook);
    const zip = await JSZip.loadAsync(buffer);
    const chapter = await readZipEntry(zip, 'OEBPS/chapter-1.xhtml');

    expect(chapter).toContain('A woven story about travel.');
    expect(chapter).not.toContain('Pasta in Naples');
  });

  it('should omit entry dates when disabled', async () => {
    const withDates = await renderBookEpub(book);
    const withoutDates = await renderBookEpub(book, { includeDates: false });
    const chapterWith = await readZipEntry(await JSZip.loadAsync(withDates), 'OEBPS/chapter-1.xhtml');
    const chapterWithout = await readZipEntry(await JSZip.loadAsync(withoutDates), 'OEBPS/chapter-1.xhtml');

    expect(chapterWith).toContain('2024-01-10');
    expect(chapterWithout).not.toContain('2024-01-10');
  });
});

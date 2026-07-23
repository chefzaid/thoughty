import { renderBookPdf } from './book-pdf.util';
import { Book } from './book-converter.util';

describe('renderBookPdf', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const book: Book = {
    title: 'My Book',
    author: 'Jane',
    generatedAt: '2024-06-01',
    chapters: [
      {
        title: 'Travel',
        entries: [
          { date: '2024-01-10', index: 1, tags: ['travel'], content: 'Pasta in Naples', format: 'plain' },
          { date: '2024-01-15', index: 1, tags: ['travel'], content: '# Rome\n**Great** trip', format: 'markdown' },
        ],
      },
      {
        title: 'Food',
        entries: [
          { date: '2024-02-01', index: 1, tags: ['food'], content: 'Cooking at home', format: 'plain' },
        ],
      },
    ],
  };

  it('should produce a valid non-empty PDF buffer', async () => {
    const buffer = await renderBookPdf(book);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.subarray(-6).toString()).toContain('%%EOF');
  });

  it('should embed title and author metadata', async () => {
    const buffer = await renderBookPdf(book);
    const raw = buffer.toString('latin1');

    expect(raw).toContain('My Book');
    expect(raw).toContain('Jane');
  });

  it('should render without a table of contents when disabled', async () => {
    const withToc = await renderBookPdf(book, { includeToc: true });
    const withoutToc = await renderBookPdf(book, { includeToc: false });

    expect(withoutToc.length).toBeLessThan(withToc.length);
  });

  it('should render narrative chapters without error', async () => {
    const narrativeBook: Book = {
      ...book,
      chapters: [{
        ...book.chapters[0],
        introduction: 'An opening.',
        narrative: 'A woven story.\n\nMore prose.',
        summary: 'A closing recap.',
      }],
    };
    const buffer = await renderBookPdf(narrativeBook);

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should handle a book with no chapters', async () => {
    const empty: Book = { title: 'Empty', generatedAt: '2024-06-01', chapters: [] };
    const buffer = await renderBookPdf(empty);

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should render a themed cover image without error', async () => {
    const buffer = await renderBookPdf({
      ...book,
      cover: {
        theme: 'ocean',
        image: { data: png, mimeType: 'image/png' },
      },
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('should render supported entry images and skip unsupported or corrupt ones', async () => {
    const imageBook: Book = {
      ...book,
      chapters: [{
        ...book.chapters[0],
        narrative: 'Woven chapter',
        entries: [{
          ...book.chapters[0].entries[0],
          images: [
            {
              id: 1,
              name: 'photo.png',
              storedFilename: 'photo.png',
              mimeType: 'image/png',
              size: png.length,
              data: png,
            },
            {
              id: 2,
              name: 'animation.gif',
              storedFilename: 'animation.gif',
              mimeType: 'image/gif',
              size: 3,
              data: Buffer.from('gif'),
            },
            {
              id: 3,
              name: 'broken.png',
              storedFilename: 'broken.png',
              mimeType: 'image/png',
              size: 3,
              data: Buffer.from('bad'),
            },
          ],
        }],
      }],
    };

    const buffer = await renderBookPdf(imageBook);

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

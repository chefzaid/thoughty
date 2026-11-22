import JSZip from 'jszip';
import { BOOK_INTERIOR_STYLES, BOOK_INTERIOR_THEMES, bookInteriorStyle, type BookInteriorTheme } from './book-interior.util';
import { renderBookPdf } from './book-pdf.util';
import { renderBookEpub } from './book-epub.util';
import { renderBookHtml, type Book } from './book-converter.util';
import { pdfTextRuns } from './book-pdf.test-helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const LONG_TEXT = 'We walked along the harbour while the light went down over the boats. '.repeat(30);

function book(interior?: BookInteriorTheme): Book {
  return {
    title: 'Garden Notes',
    author: 'Jane',
    generatedAt: '2024-06-01',
    interior,
    dedication: 'For Marie',
    closingPage: true,
    chapters: [{
      title: 'Travel',
      entries: [
        {
          date: '2024-01-10',
          index: 1,
          title: 'Naples',
          tags: [],
          content: LONG_TEXT,
          format: 'plain',
          images: [{ id: 1, name: 'harbour.png', storedFilename: 'harbour.png', mimeType: 'image/png', size: PNG.length, data: PNG }],
        },
        { date: '2024-01-15', index: 1, tags: [], content: LONG_TEXT, format: 'plain' },
      ],
    }],
  };
}

function pageCount(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
}

function baseFonts(pdf: Buffer): string[] {
  return [...new Set([...pdf.toString('latin1').matchAll(/\/BaseFont \/([\w-]+)/g)].map(([, name]) => name))].sort((a, b) => a.localeCompare(b));
}

describe('book interior themes', () => {
  it('reads no theme as the standard one', () => {
    expect(bookInteriorStyle()).toBe(BOOK_INTERIOR_STYLES.standard);
    expect(bookInteriorStyle('elegant')).toBe(BOOK_INTERIOR_STYLES.elegant);
  });

  it('defines every theme with sizes that keep headings above the text and a photo inside the text width', () => {
    for (const theme of BOOK_INTERIOR_THEMES) {
      const style = BOOK_INTERIOR_STYLES[theme];
      expect(style.chapterSize).toBeGreaterThan(style.bodySize);
      expect(style.titleSize).toBeGreaterThan(style.chapterSize);
      expect(style.photoWidth).toBeGreaterThan(0);
      expect(style.photoWidth).toBeLessThanOrEqual(1);
    }
  });

  describe('in the PDF', () => {
    it('sets the standard book in Helvetica, as without a theme', async () => {
      const [standard, none] = await Promise.all([renderBookPdf(book('standard')), renderBookPdf(book())]);

      expect(baseFonts(standard)).toEqual(['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique']);
      expect(pageCount(standard)).toBe(pageCount(none));
      expect(pdfTextRuns(standard)).toEqual(pdfTextRuns(none));
    });

    it('sets the elegant book in Times, opening each chapter with its number in capitals', async () => {
      const pdf = await renderBookPdf(book('elegant'));

      expect(baseFonts(pdf)).toEqual(['Times-Bold', 'Times-Italic', 'Times-Roman']);
      const runs = pdfTextRuns(pdf);
      expect(runs).toContain('CHAPTER 1');
      expect(runs).not.toContain('Chapter 1');
      expect(runs).toContain('Travel');
    });

    it('gives the large-print book more pages than the standard one', async () => {
      const [standard, largePrint] = await Promise.all([renderBookPdf(book('standard')), renderBookPdf(book('large-print'))]);

      expect(baseFonts(largePrint)).toEqual(['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique']);
      expect(pageCount(largePrint)).toBeGreaterThan(pageCount(standard));
      expect(pdfTextRuns(largePrint)).toContain('Chapter 1');
    });

    it('keeps the photo caption under the photo in every theme', async () => {
      for (const theme of BOOK_INTERIOR_THEMES) {
        const runs = pdfTextRuns(await renderBookPdf(book(theme)));
        expect(runs.some((run) => run.includes('harbour.png'))).toBe(true);
      }
    });
  });

  describe('in the HTML and EPUB', () => {
    it('adds no style rules for the standard book', async () => {
      expect(renderBookHtml(book('standard'))).toBe(renderBookHtml(book()));
      const zip = await JSZip.loadAsync(await renderBookEpub(book('standard')));
      expect(await zip.file('OEBPS/styles.css')?.async('string')).not.toContain('Georgia');
    });

    it("adds the theme's style rules after the format's own", async () => {
      const html = renderBookHtml(book('elegant'));
      expect(html).toContain(BOOK_INTERIOR_STYLES.elegant.css);
      expect(html.indexOf(BOOK_INTERIOR_STYLES.elegant.css)).toBeLessThan(html.indexOf('</style>'));
      expect(html.indexOf('.closing-page{')).toBeLessThan(html.indexOf(BOOK_INTERIOR_STYLES.elegant.css));

      const zip = await JSZip.loadAsync(await renderBookEpub(book('large-print')));
      const styles = await zip.file('OEBPS/styles.css')?.async('string');
      expect(styles?.endsWith(BOOK_INTERIOR_STYLES['large-print'].css)).toBe(true);
    });
  });
});

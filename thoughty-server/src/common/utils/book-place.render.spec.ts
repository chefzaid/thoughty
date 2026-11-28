import JSZip from 'jszip';
import { buildBook, buildJournalDocument, renderBookHtml, renderBookMarkdown, type Book } from './book-converter.util';
import { renderBookEpub } from './book-epub.util';
import { renderBookPdf } from './book-pdf.util';
import { pdfTextRuns } from './book-pdf.test-helpers';
import { formatBookPlace } from './book-language.util';

const placed = [
  { id: 1, date: '2024-05-01', index: 1, tags: [], content: 'A walk by the lake', locationName: 'Annecy, France', latitude: 45.8992, longitude: 6.1294 },
  { id: 2, date: '2024-05-02', index: 1, tags: [], content: 'Lost on the trail', locationName: null, latitude: -33.86882, longitude: -151.20929 },
  { id: 3, date: '2024-05-03', index: 1, tags: [], content: 'At home', locationName: null, latitude: null, longitude: null },
];

describe('formatBookPlace', () => {
  it('prints the name the writer gave the place, on one line', () => {
    expect(formatBookPlace({ name: '  Annecy,\n France ', latitude: 45.9, longitude: 6.1 })).toBe('Annecy, France');
  });

  it('prints coordinates without a name, in the book’s language', () => {
    expect(formatBookPlace({ name: null, latitude: 45.89921, longitude: 6.12944 })).toBe('45.8992° N, 6.1294° E');
    expect(formatBookPlace({ name: null, latitude: -33.86882, longitude: -151.20929 }, 'fr')).toBe('33,8688° S, 151,2093° O');
    expect(formatBookPlace({ name: '', latitude: -1.5, longitude: -2 }, 'en')).toBe('1.5° S, 2° W');
  });

  it('is undefined without a place, or with a coordinate missing', () => {
    expect(formatBookPlace(null)).toBeUndefined();
    expect(formatBookPlace(undefined)).toBeUndefined();
    expect(formatBookPlace({ name: ' ', latitude: null, longitude: null })).toBeUndefined();
    expect(formatBookPlace({ name: null, latitude: 45, longitude: null })).toBeUndefined();
  });
});

describe('places in books', () => {
  it('leaves every place out unless the book is made with places', () => {
    const book = buildBook(placed, { title: 'Book', chapterMode: 'single' });

    expect(book.chapters[0].entries.map((entry) => entry.place)).toEqual([undefined, undefined, undefined]);
  });

  it('gives each entry its place in the book’s language when asked, whatever the chapters', () => {
    for (const chapterMode of ['tags', 'month', 'eras'] as const) {
      const book = buildBook(placed, { title: 'Livre', chapterMode, language: 'fr', includeLocation: true });

      expect(book.chapters[0].entries.map((entry) => entry.place)).toEqual(['Annecy, France', '33,8688° S, 151,2093° O', undefined]);
    }
  });

  it('never puts places in the journal documents', () => {
    const document = buildJournalDocument(placed, { title: 'Journal' });

    expect(document.chapters[0].entries.every((entry) => entry.place === undefined)).toBe(true);
  });

  const book = buildBook(placed, { title: 'Book', chapterMode: 'single', includeLocation: true });
  book.chapters[0].entries[0].place = 'Café <Rive> *gauche*';

  it('prints the place under the date in Markdown, as written', () => {
    const markdown = renderBookMarkdown(book);

    expect(markdown).toContain(String.raw`### May 1, 2024` + '\n\n' + String.raw`*Café \<Rive\> \*gauche\**` + '\n\nA walk by the lake');
    expect(markdown).toContain(String.raw`*33\.8688° S\, 151\.2093° W*`);
    expect(markdown.match(/^\*.*\*$/gm)).toHaveLength(3); // the made-on line and two places, none for the entry without one
  });

  it('prints the place under the date in HTML and EPUB, escaped', async () => {
    const html = renderBookHtml(book);
    const zip = await JSZip.loadAsync(await renderBookEpub(book));
    const chapter = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');

    expect(html).toContain('<div class="entry-date">May 1, 2024</div>\n<div class="entry-place">Café &lt;Rive&gt; *gauche*</div>');
    expect(html).toContain('.entry-place{');
    expect(html.match(/class="entry-place"/g)).toHaveLength(2);
    expect(chapter).toContain('<p class="entry-date">May 1, 2024</p>\n<p class="entry-place">Café &lt;Rive&gt; *gauche*</p>');
    expect(chapter.match(/class="entry-place"/g)).toHaveLength(2);
  });

  it('prints the place under the date in PDF, and without dates still prints it', async () => {
    const withDates = pdfTextRuns(await renderBookPdf(book));
    const withoutDates = pdfTextRuns(await renderBookPdf(book, { includeDates: false }));

    expect(withDates.indexOf('Café <Rive> *gauche*')).toBe(withDates.indexOf('May 1, 2024') + 1);
    expect(withDates).toContain('33.8688° S, 151.2093° W');
    expect(withoutDates).toEqual(expect.arrayContaining(['Café <Rive> *gauche*', '33.8688° S, 151.2093° W']));
    expect(renderBookMarkdown(book, { includeDates: false })).toContain(String.raw`*Café \<Rive\> \*gauche\**`);
  });

  it('shows no place in an AI-woven chapter, which lists no entries', () => {
    const woven: Book = { ...book, chapters: [{ ...book.chapters[0], narrative: 'The month in prose.' }] };

    expect(renderBookMarkdown(woven)).not.toContain('gauche');
    expect(renderBookHtml(woven)).not.toContain('entry-place"');
  });
});

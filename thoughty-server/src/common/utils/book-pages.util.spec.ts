import JSZip from 'jszip';
import { Book, renderBookHtml, renderBookMarkdown } from './book-converter.util';
import { renderBookEpub } from './book-epub.util';
import { renderBookPdf } from './book-pdf.util';
import { bookClosingPageLines, bookPageMarkdownLines, escapeBookMarkdownText, normalizeBookPageText } from './book-pages.util';

const book: Book = {
  title: 'My Book',
  author: 'Jane',
  generatedAt: '2024-06-01',
  chapters: [
    {
      title: 'Travel',
      entries: [{ date: '2024-01-10', index: 1, tags: ['travel'], content: 'Pasta in Naples', format: 'plain' }],
    },
  ],
};
const withPages: Book = {
  ...book,
  dedication: 'For <b>Marie</b> & "Jo"',
  epigraph: 'We remember *moments*.\n— Pavese\n\n<img src=x onerror=alert(1)>',
};

function pdfPageCount(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
}

describe('book pages text', () => {
  it('normalizes line breaks, line ends and blank lines, and drops blank texts', () => {
    expect(normalizeBookPageText('  For you,  \r\n\r\n\r\n\rwith love \n')).toBe('For you,\n\nwith love');
    expect(normalizeBookPageText(' \n ')).toBeUndefined();
    expect(normalizeBookPageText(undefined)).toBeUndefined();
  });

  it('escapes every ASCII punctuation mark for Markdown', () => {
    expect(escapeBookMarkdownText('<b>*a*</b> & [x](y) — é')).toBe(String.raw`\<b\>\*a\*\<\/b\> \& \[x\]\(y\) — é`);
  });

  it('prints each line in italics, with hard breaks inside a paragraph', () => {
    expect(bookPageMarkdownLines('One\nTwo\n\nThree')).toEqual(['*One*\\', '*Two*', '', '*Three*']);
  });
});

describe('dedication and epigraph pages', () => {
  it('follow the title page in Markdown, escaped, before the contents', () => {
    const markdown = renderBookMarkdown(withPages);

    expect(markdown).toContain(String.raw`*For \<b\>Marie\<\/b\> \& \"Jo\"*`);
    expect(markdown).toContain('*We remember \\*moments\\*\\.*\\\n*— Pavese*');
    expect(markdown).toContain(String.raw`*\<img src\=x onerror\=alert\(1\)\>*`);
    expect(markdown.indexOf('Marie')).toBeLessThan(markdown.indexOf('moments'));
    expect(markdown.indexOf('Pavese')).toBeLessThan(markdown.indexOf('## Table of Contents'));
  });

  it('follow the cover in Markdown too', () => {
    const markdown = renderBookMarkdown({ ...withPages, cover: { theme: 'ocean' } });

    expect(markdown.indexOf('</div>')).toBeLessThan(markdown.indexOf('Marie'));
  });

  it('are pages of their own in HTML, escaped, keeping line breaks and paragraphs', () => {
    const html = renderBookHtml(withPages);

    expect(html).toContain('<section class="dedication">\n<p>For &lt;b&gt;Marie&lt;/b&gt; &amp; &quot;Jo&quot;</p>\n</section>');
    expect(html).toContain('<section class="epigraph">\n<p>We remember *moments*.\n— Pavese</p>\n<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    expect(html).not.toContain('<img src=x');
    expect(html.indexOf('class="epigraph"')).toBeLessThan(html.indexOf('class="toc"'));
  });

  it('leave HTML and Markdown as they were without them', () => {
    expect(renderBookHtml(book)).not.toContain('<section class="dedication"');
    expect(renderBookMarkdown(book)).not.toContain('---');
  });

  it('are EPUB documents after the title page, in the spine and the navigation, escaped', async () => {
    const zip = await JSZip.loadAsync(await renderBookEpub(withPages));
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');
    const dedication = await zip.file('OEBPS/dedication.xhtml')!.async('string');
    const epigraph = await zip.file('OEBPS/epigraph.xhtml')!.async('string');

    expect(opf).toContain('<itemref idref="title"/>\n<itemref idref="dedication"/>\n<itemref idref="epigraph"/>\n<itemref idref="nav"/>');
    expect(opf).toContain('<item id="dedication" href="dedication.xhtml" media-type="application/xhtml+xml"/>');
    expect(nav).toContain('<li><a href="dedication.xhtml">Dedication</a></li>\n<li><a href="epigraph.xhtml">Epigraph</a></li>');
    expect(dedication).toContain('<section class="dedication" epub:type="dedication">\n<p>For &lt;b&gt;Marie&lt;/b&gt; &amp; &quot;Jo&quot;</p>');
    expect(epigraph).toContain('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });

  it('leave the EPUB without those documents when there are none', async () => {
    const zip = await JSZip.loadAsync(await renderBookEpub(book));

    expect(zip.file('OEBPS/dedication.xhtml')).toBeNull();
    expect(await zip.file('OEBPS/content.opf')!.async('string')).not.toContain('dedication');
  });

  it('add a PDF page each, named so a reader can find it, and name the contents page', async () => {
    const plain = await renderBookPdf(book);
    const pdf = await renderBookPdf(withPages);
    const raw = pdf.toString('latin1');

    expect(pdfPageCount(pdf)).toBe(pdfPageCount(plain) + 2);
    expect(raw).toContain('(contents)');
    expect(raw).toContain('(dedication)');
    expect(raw).toContain('(epigraph)');
    expect(plain.toString('latin1')).not.toContain('(dedication)');
  });

  it('add only the pages that have a text', async () => {
    const pdf = await renderBookPdf({ ...book, epigraph: 'Only a quotation' }, { includeToc: false });
    const raw = pdf.toString('latin1');

    expect(pdfPageCount(pdf)).toBe(3);
    expect(raw).toContain('(epigraph)');
    expect(raw).not.toContain('(dedication)');
    expect(raw).not.toContain('(contents)');
  });
});

describe('the closing page', () => {
  const shared = { id: 7, date: '2023-12-31', index: 1, tags: ['a', 'b'], content: 'In two chapters', format: 'plain' as const };
  const longBook: Book = {
    ...book,
    title: 'Notes <b>',
    closingPage: true,
    chapters: [
      { title: 'A', entries: [shared, { date: '2024-02-01', index: 1, tags: ['a'], content: 'Later', format: 'plain' }] },
      { title: 'B', entries: [shared] },
    ],
  };

  it('gives the dates of the first and last entries, each entry once, and the day the book was made', () => {
    expect(bookClosingPageLines(longBook)).toEqual(['Entries from December 31, 2023 to February 1, 2024', '2 entries', 'Made with Thoughty on June 1, 2024']);
    expect(bookClosingPageLines(book)).toEqual(['Entries from January 10, 2024', '1 entry', 'Made with Thoughty on June 1, 2024']);
    expect(bookClosingPageLines({ ...book, chapters: [] })).toEqual(['0 entries', 'Made with Thoughty on June 1, 2024']);
  });

  it('ends the Markdown and HTML books', () => {
    const markdown = renderBookMarkdown(longBook);
    const html = renderBookHtml(longBook);

    expect(markdown.trimEnd().endsWith('## About this book\n\nEntries from December 31, 2023 to February 1, 2024\n\n2 entries\n\nMade with Thoughty on June 1, 2024')).toBe(true);
    expect(html).toContain('<section class="closing-page">\n<h2>About this book</h2>\n<p>Entries from December 31, 2023 to February 1, 2024</p>\n<p>2 entries</p>');
    expect(html.indexOf('class="closing-page"')).toBeGreaterThan(html.lastIndexOf('class="chapter"'));
    expect(renderBookHtml(book)).not.toContain('<section class="closing-page"');
    expect(renderBookMarkdown(book)).not.toContain('About this book');
  });

  it('is the last EPUB document, in the navigation, as a colophon', async () => {
    const zip = await JSZip.loadAsync(await renderBookEpub(longBook));
    const opf = await zip.file('OEBPS/content.opf')!.async('string');

    expect(opf).toContain('<itemref idref="chapter-2"/>\n<itemref idref="about"/>\n</spine>');
    expect(await zip.file('OEBPS/nav.xhtml')!.async('string')).toContain('<li><a href="about.xhtml">About this book</a></li>');
    expect(await zip.file('OEBPS/about.xhtml')!.async('string')).toContain('<section class="closing-page" epub:type="colophon">\n<h2>About this book</h2>\n<p>Entries from December 31, 2023 to February 1, 2024</p>');
    expect((await JSZip.loadAsync(await renderBookEpub(book))).file('OEBPS/about.xhtml')).toBeNull();
  });

  it('is the last PDF page, named so a reader can find it', async () => {
    const plain = await renderBookPdf(book);
    const pdf = await renderBookPdf({ ...book, closingPage: true });

    expect(pdfPageCount(pdf)).toBe(pdfPageCount(plain) + 1);
    expect(pdf.toString('latin1')).toContain('(about)');
    expect(plain.toString('latin1')).not.toContain('(about)');
  });
});

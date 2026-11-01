import JSZip from 'jszip';
import { renderBookHtml, renderBookMarkdown, type Book } from './book-converter.util';
import { renderBookEpub } from './book-epub.util';
import { renderBookPdf } from './book-pdf.util';
import { pdfTextRuns } from './book-pdf.test-helpers';
import type { BookLanguage } from './book-language.util';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

/** A book with every word the app writes itself: its pages, framing, an image, dates with and without times. */
function bookIn(language: BookLanguage | undefined): Book {
  return {
    title: 'Carnet',
    author: 'Jeanne',
    generatedAt: '2026-08-01',
    language,
    dedication: 'Pour Marie',
    epigraph: 'Les jours passent',
    closingPage: true,
    cover: { theme: 'classic', image: { data: png, mimeType: 'image/png' } },
    chapters: [
      {
        title: 'Mai 2024',
        introduction: 'Une ouverture.',
        summary: 'Un résumé.',
        entries: [
          {
            id: 1,
            date: '2024-05-01',
            index: 1,
            timeOfDay: '21:30',
            tags: [],
            content: 'Été à Paris',
            format: 'plain',
            images: [{ id: 3, name: 'jardin.png', mimeType: 'image/png', storedFilename: 'jardin.png', size: png.length, data: png }],
          },
          { id: 2, date: '2024-05-02', index: 1, tags: [], content: 'Pluie', format: 'plain' },
        ],
      },
    ],
  };
}

interface Expected {
  lang: BookLanguage;
  by: string;
  madeDay: string;
  toc: string;
  chapterNumber: string;
  chapter: string;
  introduction: string;
  summary: string;
  entryDate: string;
  caption: string;
  coverAlt: string;
  titlePage: string;
  dedication: string;
  epigraph: string;
  about: string;
  closing: string[];
}

const EXPECTED: Array<[string, BookLanguage | undefined, Expected]> = [
  ['English', 'en', {
    lang: 'en',
    by: 'by Jeanne',
    madeDay: 'August 1, 2026',
    toc: 'Table of Contents',
    chapterNumber: 'Chapter 1',
    chapter: 'Chapter 1: Mai 2024',
    introduction: 'Introduction',
    summary: 'Chapter Summary',
    entryDate: 'May 1, 2024 at 9:30 PM',
    caption: 'May 1, 2024',
    coverAlt: 'Carnet cover',
    titlePage: 'Title Page',
    dedication: 'Dedication',
    epigraph: 'Epigraph',
    about: 'About this book',
    closing: ['Entries from May 1, 2024 to May 2, 2024', '2 entries', 'Made with Thoughty on August 1, 2026'],
  }],
  ['French', 'fr', {
    lang: 'fr',
    by: 'par Jeanne',
    madeDay: '1 août 2026',
    toc: 'Table des matières',
    chapterNumber: 'Chapitre 1',
    chapter: 'Chapitre 1 : Mai 2024',
    introduction: 'Introduction',
    summary: 'Résumé du chapitre',
    entryDate: '1 mai 2024 à 21:30',
    caption: '1 mai 2024',
    coverAlt: 'Couverture de Carnet',
    titlePage: 'Page de titre',
    dedication: 'Dédicace',
    epigraph: 'Épigraphe',
    about: 'À propos de ce livre',
    closing: ['Entrées du 1 mai 2024 au 2 mai 2024', '2 entrées', 'Fait avec Thoughty le 1 août 2026'],
  }],
];

describe.each(EXPECTED)('a book in %s', (_name, language, expected) => {
  const book = bookIn(language);

  it('writes its own words in Markdown', () => {
    const markdown = renderBookMarkdown(book);
    const plain = renderBookMarkdown({ ...book, cover: undefined });

    expect(markdown).toContain(`<p><em>${expected.by}</em></p>`);
    expect(markdown).toContain(`alt="${expected.coverAlt}"`);
    expect(markdown).toContain(`<p>${expected.madeDay}</p>`);
    expect(plain).toContain(`*${expected.by}*\n\n*${expected.madeDay}*`);
    expect(markdown).toContain(`## ${expected.toc}`);
    expect(markdown).toContain(`## ${expected.chapter}`);
    expect(markdown).toContain(`### ${expected.introduction}`);
    expect(markdown).toContain(`### ${expected.summary}`);
    expect(markdown).toContain(`### ${expected.entryDate}`);
    expect(markdown).toContain(`*${expected.caption} \\- jardin\\.png*`);
    expect(markdown).toContain(`## ${expected.about}\n\n${expected.closing.join('\n\n')}`);
  });

  it('writes its own words in HTML, declaring its language', () => {
    const html = renderBookHtml(book);

    expect(html).toContain(`<html lang="${expected.lang}">`);
    expect(html).toContain(`<p class="author">${expected.by}</p>`);
    expect(html).toContain(`alt="${expected.coverAlt}"`);
    expect(html).toContain(`<p class="date">${expected.madeDay}</p>`);
    expect(html).toContain(`<h2>${expected.toc}</h2>`);
    expect(html).toContain(`<h2>${expected.chapter}</h2>`);
    expect(html).toContain(`<h3>${expected.introduction}</h3>`);
    expect(html).toContain(`<h3>${expected.summary}</h3>`);
    expect(html).toContain(`<div class="entry-date">${expected.entryDate}</div>`);
    expect(html).toContain(`<figcaption>${expected.caption} - jardin.png</figcaption>`);
    expect(html).toContain(`<h2>${expected.about}</h2>\n${expected.closing.map((line) => `<p>${line}</p>`).join('\n')}`);
  });

  it('writes its own words in EPUB, declaring its language in the package and every document', async () => {
    const zip = await JSZip.loadAsync(await renderBookEpub(book));
    const read = (name: string) => zip.file(`OEBPS/${name}`)!.async('string');
    const [opf, nav, title, dedication, epigraph, chapter, about] = await Promise.all(
      ['content.opf', 'nav.xhtml', 'title.xhtml', 'dedication.xhtml', 'epigraph.xhtml', 'chapter-1.xhtml', 'about.xhtml'].map(read),
    );

    expect(opf).toContain(`<dc:language>${expected.lang}</dc:language>`);
    for (const document of [nav, title, dedication, epigraph, chapter, about]) {
      expect(document).toContain(`xml:lang="${expected.lang}" lang="${expected.lang}"`);
    }
    expect(nav).toContain(`<title>${expected.toc}</title>`);
    expect(nav).toContain(`<h2>${expected.toc}</h2>`);
    expect(nav).toContain(`<li><a href="title.xhtml">${expected.titlePage}</a></li>`);
    expect(nav).toContain(`<li><a href="dedication.xhtml">${expected.dedication}</a></li>`);
    expect(nav).toContain(`<li><a href="epigraph.xhtml">${expected.epigraph}</a></li>`);
    expect(nav).toContain(`<li><a href="about.xhtml">${expected.about}</a></li>`);
    expect(dedication).toContain(`<title>${expected.dedication}</title>`);
    expect(epigraph).toContain(`<title>${expected.epigraph}</title>`);
    expect(title).toContain(`<p class="author">${expected.by}</p>`);
    expect(title).toContain(`alt="${expected.coverAlt}"`);
    expect(title).toContain(`<p class="date">${expected.madeDay}</p>`);
    expect(chapter).toContain(`<h2>${expected.chapter}</h2>`);
    expect(chapter).toContain(`<h3>${expected.introduction}</h3>`);
    expect(chapter).toContain(`<h3>${expected.summary}</h3>`);
    expect(chapter).toContain(`<p class="entry-date">${expected.entryDate}</p>`);
    expect(chapter).toContain(`<figcaption>${expected.caption} - jardin.png</figcaption>`);
    expect(about).toContain(`<title>${expected.about}</title>`);
    expect(about).toContain(`<h2>${expected.about}</h2>\n${expected.closing.map((line) => `<p>${line}</p>`).join('\n')}`);
  });

  it('writes its own words in PDF, declaring its language, with each chapter in the outline', async () => {
    const pdf = await renderBookPdf(book);
    const runs = pdfTextRuns(pdf);
    const raw = pdf.toString('latin1');

    expect(raw).toContain(`/Lang (${expected.lang})`);
    expect(raw).toContain(`/Title (${expected.chapter})`);
    expect(runs).toEqual(expect.arrayContaining([
      expected.by,
      expected.madeDay,
      expected.toc,
      expected.chapterNumber,
      expected.introduction,
      expected.summary,
      expected.entryDate,
      `${expected.caption} - jardin.png`,
      expected.about,
      ...expected.closing,
    ]));
  });
});

describe('a book without a language', () => {
  it('is written in English, as before', async () => {
    const book = bookIn(undefined);
    const zip = await JSZip.loadAsync(await renderBookEpub(book));

    expect(renderBookHtml(book)).toContain('<html lang="en">');
    expect(await zip.file('OEBPS/content.opf')!.async('string')).toContain('<dc:language>en</dc:language>');
    expect(pdfTextRuns(await renderBookPdf(book))).toContain('Made with Thoughty on August 1, 2026');
    expect(renderBookMarkdown(book)).toContain('## Chapter 1: Mai 2024');
  });
});

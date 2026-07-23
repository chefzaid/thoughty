import JSZip from 'jszip';
import { randomUUID } from 'node:crypto';
import { Book, RenderBookOptions } from './book-converter.util';
import { BOOK_COVER_PALETTES } from './book-cover-style.util';
import {
  bookImageExtension,
  type EmbeddedBookImage,
} from './book-image.util';

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function xhtmlDocument(title: string, body: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!DOCTYPE html>',
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">',
    '<head>',
    `<title>${escapeXml(title)}</title>`,
    '<link rel="stylesheet" type="text/css" href="styles.css"/>',
    '</head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('\n');
}

const EPUB_STYLES = [
  'body{font-family:serif;line-height:1.6}',
  'h1,h2{text-align:center}',
  '.author{text-align:center;font-style:italic}',
  '.date{text-align:center;color:#666}',
  '.title-page{min-height:90vh;padding:3em 2em;text-align:center;box-sizing:border-box}',
  '.cover-image{display:block;max-width:100%;max-height:55vh;margin:0 auto 2em;object-fit:contain}',
  '.entry{margin-bottom:1.5em}',
  '.entry-date{color:#888;font-size:0.85em}',
  '.entry-content{white-space:pre-wrap}',
  '.entry-image{margin:1.2em 0;text-align:center}',
  '.entry-image img{display:block;max-width:100%;max-height:70vh;margin:0 auto;object-fit:contain}',
  '.entry-image figcaption{color:#666;font-size:0.8em;margin-top:0.4em}',
  '.chapter-framing{font-style:italic;color:#444;margin:1.4em 0}',
  '.chapter-summary{border-top:1px solid #ccc;padding-top:1em}',
].join('\n');

function buildTitlePage(book: Book): string {
  const palette = BOOK_COVER_PALETTES[book.cover?.theme ?? 'classic'];
  const parts = [
    `<main class="title-page" style="background:${palette.background};color:${palette.foreground};border-top:0.75em solid ${palette.accent}">`,
  ];
  if (book.cover?.image) {
    parts.push(`<img class="cover-image" src="cover.${book.cover.image.mimeType === 'image/png' ? 'png' : 'jpg'}" alt="${escapeXml(book.title)} cover"/>`);
  }
  parts.push(`<h1>${escapeXml(book.title)}</h1>`);
  if (book.author) {
    parts.push(`<p class="author">by ${escapeXml(book.author)}</p>`);
  }
  parts.push(`<p class="date">${escapeXml(book.generatedAt)}</p>`, '</main>');
  return xhtmlDocument(book.title, parts.join('\n'));
}

function buildChapterPage(
  book: Book,
  chapterIndex: number,
  includeDates: boolean,
): string {
  const chapter = book.chapters[chapterIndex];
  const parts = [`<h2>Chapter ${chapterIndex + 1}: ${escapeXml(chapter.title)}</h2>`];

  if (chapter.introduction) {
    parts.push(
      '<aside class="chapter-framing chapter-introduction">',
      '<h3>Introduction</h3>',
      `<p>${escapeXml(chapter.introduction)}</p>`,
      '</aside>',
    );
  }
  if (chapter.narrative) {
    parts.push(`<div class="entry-content">${escapeXml(chapter.narrative)}</div>`);
    for (const entry of chapter.entries) {
      renderEntryImages(parts, entry);
    }
  } else {
    for (const entry of chapter.entries) {
      parts.push('<div class="entry">');
      if (includeDates) {
        parts.push(`<p class="entry-date">${escapeXml(entry.date)}</p>`);
      }
      parts.push(`<div class="entry-content">${escapeXml(entry.content)}</div>`);
      renderEntryImages(parts, entry);
      parts.push('</div>');
    }
  }
  if (chapter.summary) {
    parts.push(
      '<aside class="chapter-framing chapter-summary">',
      '<h3>Chapter Summary</h3>',
      `<p>${escapeXml(chapter.summary)}</p>`,
      '</aside>',
    );
  }

  return xhtmlDocument(chapter.title, parts.join('\n'));
}

function renderEntryImages(
  parts: string[],
  entry: Book['chapters'][number]['entries'][number],
): void {
  for (const image of entry.images ?? []) {
    if (!image.data) {
      continue;
    }
    parts.push(
      '<figure class="entry-image">',
      `<img src="images/attachment-${image.id}.${bookImageExtension(image)}" alt="${escapeXml(image.name)}"/>`,
      `<figcaption>${escapeXml(entry.date)} - ${escapeXml(image.name)}</figcaption>`,
      '</figure>',
    );
  }
}

function collectBookImages(book: Book): EmbeddedBookImage[] {
  const images = new Map<number, EmbeddedBookImage>();
  for (const chapter of book.chapters) {
    for (const entry of chapter.entries) {
      for (const image of entry.images ?? []) {
        if (image.data && !images.has(image.id)) {
          images.set(image.id, image);
        }
      }
    }
  }
  return [...images.values()];
}

function buildNav(book: Book, includeToc: boolean): string {
  const items = [
    '<li><a href="title.xhtml">Title Page</a></li>',
    ...book.chapters.map(
      (chapter, index) =>
        `<li><a href="chapter-${index + 1}.xhtml">${escapeXml(chapter.title)}</a></li>`,
    ),
  ];
  const hidden = includeToc ? '' : ' hidden=""';

  return xhtmlDocument(
    'Table of Contents',
    [
      `<nav epub:type="toc"${hidden}>`,
      '<h2>Table of Contents</h2>',
      '<ol>',
      ...items,
      '</ol>',
      '</nav>',
    ].join('\n'),
  );
}

function buildOpf(book: Book, identifier: string): string {
  const chapterManifest = book.chapters
    .map(
      (_, index) =>
        `<item id="chapter-${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join('\n');
  const chapterSpine = book.chapters
    .map((_, index) => `<itemref idref="chapter-${index + 1}"/>`)
    .join('\n');
  const author = book.author ? `<dc:creator>${escapeXml(book.author)}</dc:creator>` : '';
  const coverManifest = book.cover?.image
    ? `<item id="cover-image" href="cover.${book.cover.image.mimeType === 'image/png' ? 'png' : 'jpg'}" media-type="${book.cover.image.mimeType}" properties="cover-image"/>`
    : '';
  const imageManifest = collectBookImages(book)
    .map(
      (image) =>
        `<item id="entry-image-${image.id}" href="images/attachment-${image.id}.${bookImageExtension(image)}" media-type="${image.mimeType}"/>`,
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">',
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    `<dc:identifier id="book-id">urn:uuid:${identifier}</dc:identifier>`,
    `<dc:title>${escapeXml(book.title)}</dc:title>`,
    author,
    '<dc:language>en</dc:language>',
    `<meta property="dcterms:modified">${book.generatedAt}T00:00:00Z</meta>`,
    '</metadata>',
    '<manifest>',
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="styles" href="styles.css" media-type="text/css"/>',
    coverManifest,
    imageManifest,
    chapterManifest,
    '</manifest>',
    '<spine>',
    '<itemref idref="title"/>',
    '<itemref idref="nav"/>',
    chapterSpine,
    '</spine>',
    '</package>',
  ]
    .filter(Boolean)
    .join('\n');
}

const CONTAINER_XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
  '<rootfiles>',
  '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
  '</rootfiles>',
  '</container>',
].join('\n');

/**
 * Render a book as an EPUB 3 file (zip with XHTML chapters) for e-readers.
 */
export async function renderBookEpub(book: Book, options: RenderBookOptions = {}): Promise<Buffer> {
  const includeDates = options.includeDates !== false;
  const includeToc = options.includeToc !== false;
  const zip = new JSZip();

  // The mimetype entry must come first and be stored uncompressed per the EPUB spec
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', CONTAINER_XML);
  zip.file('OEBPS/content.opf', buildOpf(book, randomUUID()));
  zip.file('OEBPS/nav.xhtml', buildNav(book, includeToc));
  zip.file('OEBPS/title.xhtml', buildTitlePage(book));
  zip.file('OEBPS/styles.css', EPUB_STYLES);
  if (book.cover?.image) {
    const extension = book.cover.image.mimeType === 'image/png' ? 'png' : 'jpg';
    zip.file(`OEBPS/cover.${extension}`, book.cover.image.data);
  }
  for (const image of collectBookImages(book)) {
    zip.file(
      `OEBPS/images/attachment-${image.id}.${bookImageExtension(image)}`,
      image.data!,
    );
  }

  for (let index = 0; index < book.chapters.length; index++) {
    zip.file(`OEBPS/chapter-${index + 1}.xhtml`, buildChapterPage(book, index, includeDates));
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType: 'application/epub+zip',
  });
}

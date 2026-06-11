import JSZip from 'jszip';
import { randomUUID } from 'node:crypto';
import { Book, RenderBookOptions } from './book-converter.util';

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
  '.entry{margin-bottom:1.5em}',
  '.entry-date{color:#888;font-size:0.85em}',
  '.entry-content{white-space:pre-wrap}',
].join('\n');

function buildTitlePage(book: Book): string {
  const parts = [`<h1>${escapeXml(book.title)}</h1>`];
  if (book.author) {
    parts.push(`<p class="author">by ${escapeXml(book.author)}</p>`);
  }
  parts.push(`<p class="date">${escapeXml(book.generatedAt)}</p>`);
  return xhtmlDocument(book.title, parts.join('\n'));
}

function buildChapterPage(
  book: Book,
  chapterIndex: number,
  includeDates: boolean,
): string {
  const chapter = book.chapters[chapterIndex];
  const parts = [`<h2>Chapter ${chapterIndex + 1}: ${escapeXml(chapter.title)}</h2>`];

  if (chapter.narrative) {
    parts.push(`<div class="entry-content">${escapeXml(chapter.narrative)}</div>`);
  } else {
    for (const entry of chapter.entries) {
      parts.push('<div class="entry">');
      if (includeDates) {
        parts.push(`<p class="entry-date">${escapeXml(entry.date)}</p>`);
      }
      parts.push(`<div class="entry-content">${escapeXml(entry.content)}</div>`, '</div>');
    }
  }

  return xhtmlDocument(chapter.title, parts.join('\n'));
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

  for (let index = 0; index < book.chapters.length; index++) {
    zip.file(`OEBPS/chapter-${index + 1}.xhtml`, buildChapterPage(book, index, includeDates));
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType: 'application/epub+zip',
  });
}

import { BOOK_COVER_PALETTES } from './book-cover-style.util';
import { bookImageDataUri, escapeBookImageMarkdownText } from './book-image.util';
import { escapeHtml } from './sanitize.util';
import {
  type Book,
  type BookChapter,
  type BookEntry,
  bookEntryHeading,
  formatBookEntryDate,
  type RenderBookOptions,
} from './book-model.util';

/**
 * Render a book as a single Markdown document with title page and chapter headings.
 */
export function renderBookMarkdown(book: Book, options: RenderBookOptions = {}): string {
  const includeDates = options.includeDates !== false;
  const includeToc = options.includeToc !== false;
  const lines: string[] = [];

  if (book.cover) {
    const palette = BOOK_COVER_PALETTES[book.cover.theme];
    lines.push(
      `<div style="padding:4em 2em;text-align:center;background:${palette.background};color:${palette.foreground};border-top:12px solid ${palette.accent}">`,
    );
    if (book.cover.image) {
      const source = `data:${book.cover.image.mimeType};base64,${book.cover.image.data.toString('base64')}`;
      lines.push(`<img src="${source}" alt="${escapeHtml(book.title)} cover" style="max-width:100%;max-height:24em" />`);
    }
    lines.push(`<h1>${escapeHtml(book.title)}</h1>`);
    if (book.author) {
      lines.push(`<p><em>by ${escapeHtml(book.author)}</em></p>`);
    }
    lines.push(`<p>${escapeHtml(book.generatedAt)}</p>`, '</div>', '');
  } else {
    lines.push(`# ${book.title}`, '');
    if (book.author) {
      lines.push(`*by ${book.author}*`, '');
    }
    lines.push(`*${book.generatedAt}*`, '');
  }

  if (includeToc && book.chapters.length > 0) {
    lines.push('## Table of Contents', '');
    book.chapters.forEach((chapter, index) => {
      lines.push(`${index + 1}. ${chapter.title}`);
    });
    lines.push('');
  }

  for (const [index, chapter] of book.chapters.entries()) { renderMarkdownChapter(lines, chapter, index, includeDates); }

  return lines.join('\n');
}

function renderMarkdownEntryImages(lines: string[], entry: BookEntry): void {
  for (const image of entry.images ?? []) {
    const source = bookImageDataUri(image);
    if (source) {
      const name = escapeBookImageMarkdownText(image.name);
      lines.push(`![${name}](${source})`, String.raw`*${entry.date} \- ${name}*`, '');
    }
  }
}

/**
 * Render a book as a standalone printable HTML document.
 */
export function renderBookHtml(book: Book, options: RenderBookOptions = {}): string {
  const includeDates = options.includeDates !== false;
  const includeToc = options.includeToc !== false;
  const coverPalette = BOOK_COVER_PALETTES[book.cover?.theme ?? 'classic'];
  const coverImage = book.cover?.image
    ? `data:${book.cover.image.mimeType};base64,${book.cover.image.data.toString('base64')}`
    : undefined;
  const parts: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(book.title)}</title>`,
    '<style>',
    'body{font-family:Georgia,serif;max-width:42em;margin:0 auto;padding:2em;line-height:1.6;color:#222}',
    '.title-page{text-align:center;min-height:46em;padding:5em 2em;box-sizing:border-box;page-break-after:always}',
    '.cover-image{display:block;max-width:100%;max-height:24em;margin:0 auto 2.5em;object-fit:contain}',
    '.title-page h1{font-size:2.4em;margin-bottom:0.4em}',
    '.title-page .author{font-style:italic;font-size:1.2em}',
    '.title-page .date{color:#666;margin-top:2em}',
    '.toc{page-break-after:always}',
    '.toc ol{line-height:2}',
    '.chapter{page-break-before:always}',
    '.chapter h2{border-bottom:1px solid #ccc;padding-bottom:0.3em}',
    '.chapter-framing{font-style:italic;color:#444;margin:1.4em 0}',
    '.chapter-summary{border-top:1px solid #ccc;padding-top:1em}',
    '.entry{margin-bottom:1.6em}',
    '.entry-date{color:#888;font-size:0.85em;margin-bottom:0.3em}',
    '.entry-title{font-size:1.15em;margin:0 0 0.4em}',
    '.entry-content{white-space:pre-wrap}',
    '.entry-image{margin:1.2em 0;text-align:center}',
    '.entry-image img{display:block;max-width:100%;max-height:34em;margin:0 auto;object-fit:contain}',
    '.entry-image figcaption{color:#666;font-size:0.8em;margin-top:0.4em}',
    '</style>',
    '</head>',
    '<body>',
    `<div class="title-page" style="background:${coverPalette.background};color:${coverPalette.foreground};border-top:12px solid ${coverPalette.accent}">`,
  ];

  if (coverImage) {
    parts.push(`<img class="cover-image" src="${coverImage}" alt="${escapeHtml(book.title)} cover">`);
  }
  parts.push(
    `<h1>${escapeHtml(book.title)}</h1>`,
  );

  if (book.author) {
    parts.push(`<p class="author">by ${escapeHtml(book.author)}</p>`);
  }
  parts.push(`<p class="date">${escapeHtml(book.generatedAt)}</p>`, '</div>');

  if (includeToc && book.chapters.length > 0) {
    parts.push('<nav class="toc">', '<h2>Table of Contents</h2>', '<ol>');
    book.chapters.forEach((chapter, index) => {
      parts.push(`<li><a href="#chapter-${index + 1}">${escapeHtml(chapter.title)}</a></li>`);
    });
    parts.push('</ol>', '</nav>');
  }

  for (const [index, chapter] of book.chapters.entries()) { renderHtmlChapter(parts, chapter, index, includeDates); }

  parts.push('</body>', '</html>');
  return parts.join('\n');
}

function renderHtmlEntryImages(parts: string[], entry: BookEntry): void {
  for (const image of entry.images ?? []) {
    const source = bookImageDataUri(image);
    if (source) {
      parts.push(
        '<figure class="entry-image">',
        `<img src="${source}" alt="${escapeHtml(image.name)}">`,
        `<figcaption>${escapeHtml(entry.date)} - ${escapeHtml(image.name)}</figcaption>`,
        '</figure>',
      );
    }
  }
}

function renderMarkdownChapter(lines: string[], chapter: BookChapter, index: number, includeDates: boolean): void {
  lines.push(`## Chapter ${index + 1}: ${chapter.title}`, '');
  if (chapter.introduction) {
    lines.push('### Introduction', '', chapter.introduction, '');
  }
  if (chapter.narrative) {
    lines.push(chapter.narrative, '');
    for (const entry of chapter.entries) {
      renderMarkdownEntryImages(lines, entry);
    }
  } else {
    for (const entry of chapter.entries) {
      const heading = bookEntryHeading(entry, includeDates);
      if (heading) {
        lines.push(`### ${heading}`, '');
      }
      lines.push(entry.content, '');
      renderMarkdownEntryImages(lines, entry);
    }
  }
  if (chapter.summary) {
    lines.push('### Chapter Summary', '', chapter.summary, '');
  }

}

function renderHtmlChapter(parts: string[], chapter: BookChapter, index: number, includeDates: boolean): void {
  parts.push(
    `<section class="chapter" id="chapter-${index + 1}">`,
    `<h2>Chapter ${index + 1}: ${escapeHtml(chapter.title)}</h2>`,
  );
  if (chapter.introduction) {
    parts.push(
      '<aside class="chapter-framing chapter-introduction">',
      '<h3>Introduction</h3>',
      `<p>${escapeHtml(chapter.introduction)}</p>`,
      '</aside>',
    );
  }
  if (chapter.narrative) {
    parts.push(`<div class="entry-content">${escapeHtml(chapter.narrative)}</div>`);
    for (const entry of chapter.entries) {
      renderHtmlEntryImages(parts, entry);
    }
  } else {
    for (const entry of chapter.entries) {
      parts.push('<article class="entry">');
      if (includeDates) {
        parts.push(`<div class="entry-date">${escapeHtml(formatBookEntryDate(entry))}</div>`);
      }
      if (entry.title) {
        parts.push(`<h3 class="entry-title">${escapeHtml(entry.title)}</h3>`);
      }
      parts.push(`<div class="entry-content">${escapeHtml(entry.content)}</div>`, '</article>');
      renderHtmlEntryImages(parts, entry);
    }
  }
  if (chapter.summary) {
    parts.push(
      '<aside class="chapter-framing chapter-summary">',
      '<h3>Chapter Summary</h3>',
      `<p>${escapeHtml(chapter.summary)}</p>`,
      '</aside>',
    );
  }
  parts.push('</section>');

}

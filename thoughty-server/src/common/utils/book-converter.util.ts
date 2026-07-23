import {
  BOOK_COVER_PALETTES,
  type BookCover,
} from './book-cover-style.util';
import {
  bookImageDataUri,
  escapeBookImageMarkdownText,
  type EmbeddedBookImage,
  normalizeEmbeddedBookImages,
} from './book-image.util';

export type ChapterOrder = 'alpha' | 'entries' | 'chrono';
export type TagScope = 'all' | 'first';
export type ChapterMode = 'tags' | 'year' | 'month';

export const UNTAGGED_CHAPTER_TITLE = 'Untagged Thoughts';

export interface BookEntry {
  id?: number;
  date: string;
  index: number;
  tags: string[];
  content: string;
  format: 'plain' | 'markdown';
  images?: EmbeddedBookImage[];
}

export interface BookChapter {
  title: string;
  entries: BookEntry[];
  /** AI-generated opening that introduces the chapter's themes */
  introduction?: string;
  /** AI-composed flowing prose for the chapter; when set, renderers use it instead of listing entries */
  narrative?: string;
  /** AI-generated closing recap of the chapter's ideas and conclusions */
  summary?: string;
}

export interface Book {
  title: string;
  author?: string;
  generatedAt: string;
  chapters: BookChapter[];
  cover?: BookCover;
}

export interface BuildBookOptions {
  title: string;
  author?: string;
  chapterMode?: ChapterMode;
  chapterOrder?: ChapterOrder;
  tagScope?: TagScope;
  includeUntagged?: boolean;
  tags?: string[];
}

interface BookEntryInput {
  id?: number;
  date: string | Date;
  index: number;
  tags: string[];
  content: string;
  format?: 'plain' | 'markdown';
  attachments?: Array<{
    id: number;
    originalFilename: string;
    storedFilename: string;
    mimetype: string;
    size: number;
  }>;
}

function normalizeDate(date: string | Date): string {
  return date instanceof Date ? date.toISOString().split('T')[0] : String(date).split('T')[0];
}

function sortChronologically(entries: BookEntry[]): BookEntry[] {
  return [...entries].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare === 0 ? a.index - b.index : dateCompare;
  });
}

function normalizeBookEntry(input: BookEntryInput): BookEntry {
  return {
    id: input.id,
    date: normalizeDate(input.date),
    index: input.index,
    tags: input.tags || [],
    content: input.content || '',
    format: input.format === 'markdown' ? 'markdown' : 'plain',
    images: normalizeEmbeddedBookImages(input.attachments),
  };
}

function resolveEntryChapterTags(
  entry: BookEntry,
  tagScope: TagScope,
  tagFilter?: Set<string>,
): string[] {
  const entryTags = tagScope === 'first' ? entry.tags.slice(0, 1) : entry.tags;
  return tagFilter ? entryTags.filter((tag) => tagFilter.has(tag.toLowerCase())) : entryTags;
}

function addEntryToChapter(chapterMap: Map<string, BookChapter>, tag: string, entry: BookEntry): void {
  const chapter = chapterMap.get(tag.toLowerCase());
  if (chapter) {
    chapter.entries.push(entry);
  } else {
    chapterMap.set(tag.toLowerCase(), { title: tag, entries: [entry] });
  }
}

function compareChapters(a: BookChapter, b: BookChapter, order: ChapterOrder): number {
  switch (order) {
    case 'entries':
      return b.entries.length - a.entries.length || a.title.localeCompare(b.title);
    case 'chrono':
      return a.entries[0].date.localeCompare(b.entries[0].date) || a.title.localeCompare(b.title);
    default:
      return a.title.localeCompare(b.title);
  }
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function createDateChapterTitle(date: string, mode: Exclude<ChapterMode, 'tags'>): string {
  const [year, month] = date.split('-');
  if (mode === 'year') {
    return year;
  }

  const monthName = MONTH_NAMES[Number.parseInt(month, 10) - 1] ?? month;
  return `${monthName} ${year}`;
}

function buildChronologicalBook(
  entries: BookEntryInput[],
  options: BuildBookOptions & { chapterMode: Exclude<ChapterMode, 'tags'> },
): Book {
  const normalized = entries.map(normalizeBookEntry).filter((entry) => entry.content.trim());
  const chapterMap = new Map<string, BookChapter>();

  for (const entry of sortChronologically(normalized)) {
    const key = options.chapterMode === 'year' ? entry.date.slice(0, 4) : entry.date.slice(0, 7);
    const chapter = chapterMap.get(key);
    if (chapter) {
      chapter.entries.push(entry);
    } else {
      chapterMap.set(key, { title: createDateChapterTitle(entry.date, options.chapterMode), entries: [entry] });
    }
  }

  return {
    title: options.title,
    author: options.author,
    generatedAt: new Date().toISOString().split('T')[0],
    chapters: [...chapterMap.values()],
  };
}

/**
 * Group journal entries into book chapters, one chapter per tag.
 * Entries inside a chapter are connected chronologically to read as a narrative.
 */
export function buildBook(entries: BookEntryInput[], options: BuildBookOptions): Book {
  if (options.chapterMode === 'year' || options.chapterMode === 'month') {
    return buildChronologicalBook(entries, { ...options, chapterMode: options.chapterMode });
  }

  const chapterOrder = options.chapterOrder || 'alpha';
  const tagScope = options.tagScope || 'all';
  const includeUntagged = options.includeUntagged !== false;
  const tagFilter = options.tags?.length
    ? new Set(options.tags.map((tag) => tag.toLowerCase()))
    : undefined;

  const chapterMap = new Map<string, BookChapter>();
  const untagged: BookEntry[] = [];

  for (const input of entries) {
    const entry = normalizeBookEntry(input);
    if (!entry.content.trim()) {
      continue;
    }

    const matchingTags = resolveEntryChapterTags(entry, tagScope, tagFilter);
    if (matchingTags.length === 0) {
      if (entry.tags.length === 0 && !tagFilter) {
        untagged.push(entry);
      }
      continue;
    }

    for (const tag of matchingTags) {
      addEntryToChapter(chapterMap, tag, entry);
    }
  }

  const chapters = [...chapterMap.values()].map((chapter) => ({
    ...chapter,
    entries: sortChronologically(chapter.entries),
  }));
  chapters.sort((a, b) => compareChapters(a, b, chapterOrder));

  if (includeUntagged && untagged.length > 0) {
    chapters.push({ title: UNTAGGED_CHAPTER_TITLE, entries: sortChronologically(untagged) });
  }

  return {
    title: options.title,
    author: options.author,
    generatedAt: new Date().toISOString().split('T')[0],
    chapters,
  };
}

/**
 * Group entries chronologically into one chapter per month ("January 2024").
 * Used by the plain document exports (PDF, HTML, EPUB) where the journal is
 * presented as a linear, dated record rather than a tag-based book.
 */
export function buildJournalDocument(
  entries: BookEntryInput[],
  options: { title: string; author?: string },
): Book {
  const normalized = entries.map(normalizeBookEntry).filter((entry) => entry.content.trim());

  const chapterMap = new Map<string, BookChapter>();
  for (const entry of sortChronologically(normalized)) {
    const [year, month] = entry.date.split('-');
    const key = `${year}-${month}`;
    const chapter = chapterMap.get(key);
    if (chapter) {
      chapter.entries.push(entry);
    } else {
      const monthName = MONTH_NAMES[Number.parseInt(month, 10) - 1] ?? month;
      chapterMap.set(key, { title: `${monthName} ${year}`, entries: [entry] });
    }
  }

  return {
    title: options.title,
    author: options.author,
    generatedAt: new Date().toISOString().split('T')[0],
    chapters: [...chapterMap.values()],
  };
}

/**
 * Strip common Markdown syntax so entry content renders cleanly as plain text (e.g. in PDFs).
 */
export function stripMarkdown(content: string): string {
  return content
    .replaceAll(/```[^\n]*\n?/g, '')
    .replaceAll(/^#{1,6}\s+/gm, '')
    .replaceAll(/^\s*>\s?/gm, '')
    .replaceAll(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll(/(\*\*|__)(.*?)\1/g, '$2')
    .replaceAll(/([*_])(.*?)\1/g, '$2')
    .replaceAll(/~~(.*?)~~/g, '$1')
    .replaceAll(/`([^`]*)`/g, '$1')
    .replaceAll(/^\s*[-*+]\s+/gm, '- ')
    .replaceAll(/^([-*_])\1{2,}\s*$/gm, '');
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface RenderBookOptions {
  includeDates?: boolean;
  includeToc?: boolean;
}

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

  for (const [index, chapter] of book.chapters.entries()) {
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
        if (includeDates) {
          lines.push(`### ${entry.date}`, '');
        }
        lines.push(entry.content, '');
        renderMarkdownEntryImages(lines, entry);
      }
    }
    if (chapter.summary) {
      lines.push('### Chapter Summary', '', chapter.summary, '');
    }
  }

  return lines.join('\n');
}

function renderMarkdownEntryImages(lines: string[], entry: BookEntry): void {
  for (const image of entry.images ?? []) {
    const source = bookImageDataUri(image);
    if (source) {
      const name = escapeBookImageMarkdownText(image.name);
      lines.push(`![${name}](${source})`, `*${entry.date} \\- ${name}*`, '');
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

  for (const [index, chapter] of book.chapters.entries()) {
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
          parts.push(`<div class="entry-date">${escapeHtml(entry.date)}</div>`);
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

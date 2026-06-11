export type ChapterOrder = 'alpha' | 'entries' | 'chrono';
export type TagScope = 'all' | 'first';

export const UNTAGGED_CHAPTER_TITLE = 'Untagged Thoughts';

export interface BookEntry {
  date: string;
  index: number;
  tags: string[];
  content: string;
  format: 'plain' | 'markdown';
}

export interface BookChapter {
  title: string;
  entries: BookEntry[];
  /** AI-composed flowing prose for the chapter; when set, renderers use it instead of listing entries */
  narrative?: string;
}

export interface Book {
  title: string;
  author?: string;
  generatedAt: string;
  chapters: BookChapter[];
}

export interface BuildBookOptions {
  title: string;
  author?: string;
  chapterOrder?: ChapterOrder;
  tagScope?: TagScope;
  includeUntagged?: boolean;
  tags?: string[];
}

interface BookEntryInput {
  date: string | Date;
  index: number;
  tags: string[];
  content: string;
  format?: 'plain' | 'markdown';
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
    date: normalizeDate(input.date),
    index: input.index,
    tags: input.tags || [],
    content: input.content || '',
    format: input.format === 'markdown' ? 'markdown' : 'plain',
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

/**
 * Group journal entries into book chapters, one chapter per tag.
 * Entries inside a chapter are connected chronologically to read as a narrative.
 */
export function buildBook(entries: BookEntryInput[], options: BuildBookOptions): Book {
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
  const lines: string[] = [`# ${book.title}`, ''];

  if (book.author) {
    lines.push(`*by ${book.author}*`, '');
  }
  lines.push(`*${book.generatedAt}*`, '');

  if (includeToc && book.chapters.length > 0) {
    lines.push('## Table of Contents', '');
    book.chapters.forEach((chapter, index) => {
      lines.push(`${index + 1}. ${chapter.title}`);
    });
    lines.push('');
  }

  for (const [index, chapter] of book.chapters.entries()) {
    lines.push(`## Chapter ${index + 1}: ${chapter.title}`, '');
    if (chapter.narrative) {
      lines.push(chapter.narrative, '');
      continue;
    }
    for (const entry of chapter.entries) {
      if (includeDates) {
        lines.push(`### ${entry.date}`, '');
      }
      lines.push(entry.content, '');
    }
  }

  return lines.join('\n');
}

/**
 * Render a book as a standalone printable HTML document.
 */
export function renderBookHtml(book: Book, options: RenderBookOptions = {}): string {
  const includeDates = options.includeDates !== false;
  const includeToc = options.includeToc !== false;
  const parts: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(book.title)}</title>`,
    '<style>',
    'body{font-family:Georgia,serif;max-width:42em;margin:0 auto;padding:2em;line-height:1.6;color:#222}',
    '.title-page{text-align:center;padding:6em 0;page-break-after:always}',
    '.title-page h1{font-size:2.4em;margin-bottom:0.4em}',
    '.title-page .author{font-style:italic;font-size:1.2em}',
    '.title-page .date{color:#666;margin-top:2em}',
    '.toc{page-break-after:always}',
    '.toc ol{line-height:2}',
    '.chapter{page-break-before:always}',
    '.chapter h2{border-bottom:1px solid #ccc;padding-bottom:0.3em}',
    '.entry{margin-bottom:1.6em}',
    '.entry-date{color:#888;font-size:0.85em;margin-bottom:0.3em}',
    '.entry-content{white-space:pre-wrap}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="title-page">',
    `<h1>${escapeHtml(book.title)}</h1>`,
  ];

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
    if (chapter.narrative) {
      parts.push(`<div class="entry-content">${escapeHtml(chapter.narrative)}</div>`);
    } else {
      for (const entry of chapter.entries) {
        parts.push('<article class="entry">');
        if (includeDates) {
          parts.push(`<div class="entry-date">${escapeHtml(entry.date)}</div>`);
        }
        parts.push(`<div class="entry-content">${escapeHtml(entry.content)}</div>`, '</article>');
      }
    }
    parts.push('</section>');
  }

  parts.push('</body>', '</html>');
  return parts.join('\n');
}

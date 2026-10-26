import { normalizeEmbeddedBookImages } from './book-image.util';
import { compareSameDayEntries, normalizeEntryTitle, normalizeTimeOfDay } from './entry-order.util';
import {
  type Book,
  type BookChapter,
  type BookEntry,
  type BuildBookOptions,
  type ChapterMode,
  type ChapterOrder,
  type TagScope,
  UNTAGGED_CHAPTER_TITLE,
} from './book-model.util';

// The book model and its Markdown and HTML renderers live in their own modules; this one builds
// books from entries and stays the entry point for all three.
export * from './book-model.util';
export * from './book-render.util';

interface BookEntryInput {
  id?: number;
  date: string | Date;
  index: number;
  title?: string | null;
  timeOfDay?: string | null;
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
    return dateCompare === 0 ? compareSameDayEntries(a, b) : dateCompare;
  });
}

function normalizeBookEntry(input: BookEntryInput): BookEntry {
  return {
    id: input.id,
    date: normalizeDate(input.date),
    index: input.index,
    title: normalizeEntryTitle(input.title),
    timeOfDay: normalizeTimeOfDay(input.timeOfDay),
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
    .replaceAll(/^[\t ]*>[\t ]?/gm, '')
    .replaceAll(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/\[([^[\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll(/(\*\*|__)(.*?)\1/g, '$2')
    .replaceAll(/([*_])(.*?)\1/g, '$2')
    .replaceAll(/~~(.*?)~~/g, '$1')
    .replaceAll(/`([^`]*)`/g, '$1')
    .replaceAll(/^[\t ]*[-*+][\t ]+/gm, '- ')
    .replaceAll(/^([-*_])\1{2,}\s*$/gm, '');
}

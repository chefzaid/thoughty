import type { BookCover } from './book-cover-style.util';
import type { EmbeddedBookImage } from './book-image.util';

export type ChapterOrder = 'alpha' | 'entries' | 'chrono';
export type TagScope = 'all' | 'first';
export type ChapterMode = 'tags' | 'year' | 'month';

export const UNTAGGED_CHAPTER_TITLE = 'Untagged Thoughts';

export interface BookEntry {
  id?: number;
  date: string;
  index: number;
  title?: string | null;
  timeOfDay?: string | null;
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

/** The entry's date followed by its time of day when it has one, as books and documents print it. */
export function formatBookEntryDate(entry: Pick<BookEntry, 'date' | 'timeOfDay'>): string {
  return entry.timeOfDay ? `${entry.date} ${entry.timeOfDay}` : entry.date;
}

/**
 * An entry's section heading in a book: its date and time when dates are printed, then its title.
 * Null when dates are left out and the entry has no title.
 */
export function bookEntryHeading(entry: Pick<BookEntry, 'date' | 'timeOfDay' | 'title'>, includeDates: boolean): string | null {
  const parts = [includeDates ? formatBookEntryDate(entry) : null, entry.title || null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export interface RenderBookOptions {
  includeDates?: boolean;
  includeToc?: boolean;
}

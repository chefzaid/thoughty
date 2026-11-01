import type { BookCover } from './book-cover-style.util';
import type { EmbeddedBookImage } from './book-image.util';
import type { BookEra } from './book-era.util';
import { formatBookDate, type BookLanguage } from './book-language.util';

export type ChapterOrder = 'alpha' | 'entries' | 'chrono';
export type TagScope = 'all' | 'first';
/** One chapter per tag, per calendar year or month, per life era, or the whole book as a single chapter. */
export type ChapterMode = 'tags' | 'year' | 'month' | 'single' | 'eras';

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
  /** A short dedication, on its own page after the title page. */
  dedication?: string;
  /** A short epigraph (a quotation and who said it), on its own page after the dedication. */
  epigraph?: string;
  /** Ends the book with an "About this book" page: its dates, entry count and the day it was made. */
  closingPage?: boolean;
  /** The language of the words the book writes itself (headings, labels, dates); English without one. */
  language?: BookLanguage;
}

export interface BuildBookOptions {
  title: string;
  author?: string;
  chapterMode?: ChapterMode;
  chapterOrder?: ChapterOrder;
  tagScope?: TagScope;
  /** Tag chapters: add one for untagged entries. Era chapters: add one for entries outside every era. */
  includeUntagged?: boolean;
  tags?: string[];
  /** The writer's life eras, for era chapters. */
  eras?: BookEra[];
  /** The writer's day the book is made on: its date, and the end of an ongoing era. The UTC day without it. */
  today?: string;
  /** The writer's language, for the chapter titles the book writes itself (months, untagged, other). */
  language?: BookLanguage;
}

/** The entry's date, with its time of day when it has one, as books and documents print it in their language. */
export function formatBookEntryDate(entry: Pick<BookEntry, 'date' | 'timeOfDay'>, language?: BookLanguage): string {
  return formatBookDate(entry.date, language, entry.timeOfDay);
}

/**
 * An entry's section heading in a book: its date and time when dates are printed, then its title.
 * Null when dates are left out and the entry has no title.
 */
export function bookEntryHeading(
  entry: Pick<BookEntry, 'date' | 'timeOfDay' | 'title'>,
  includeDates: boolean,
  language?: BookLanguage,
): string | null {
  const parts = [includeDates ? formatBookEntryDate(entry, language) : null, entry.title || null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export interface RenderBookOptions {
  includeDates?: boolean;
  includeToc?: boolean;
}

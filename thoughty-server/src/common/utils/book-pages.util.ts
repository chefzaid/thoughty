import type { Book } from './book-model.util';
import { bookCopy, formatBookDate, formatBookEntryCount } from './book-language.util';

/** The longest dedication a book takes, in characters: a few lines on its own page. */
export const MAX_BOOK_DEDICATION_LENGTH = 300;
/** The longest epigraph a book takes, in characters: a short quotation and who said it. */
export const MAX_BOOK_EPIGRAPH_LENGTH = 500;

/**
 * A dedication or epigraph as a book prints it: Windows line breaks made plain, spaces at the ends of
 * lines dropped, at most one blank line between paragraphs, and nothing around it. Undefined when
 * nothing is left.
 */
export function normalizeBookPageText(text: string | undefined): string | undefined {
  const normalized = (text ?? '')
    .replaceAll(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || undefined;
}

/** Text Markdown shows as written: every ASCII punctuation mark escaped, so none starts markup or HTML. */
export function escapeBookMarkdownText(text: string): string {
  return text.replaceAll(/[!-/:-@[-`{-~]/g, String.raw`\$&`);
}

/**
 * A dedication or epigraph as Markdown lines: each line escaped and in italics, its line breaks kept as
 * hard breaks and its blank lines as paragraph breaks.
 */
export function bookPageMarkdownLines(text: string): string[] {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    if (!line.trim()) {
      return '';
    }
    const hardBreak = lines[index + 1]?.trim() ? '\\' : '';
    return `*${escapeBookMarkdownText(line.trim())}*${hardBreak}`;
  });
}

/**
 * The closing page's lines, so a printed copy carries its own context: the dates of its first and
 * last entries, how many entries it holds (each counted once, however many chapters it is in), and
 * the writer's day it was made on, in the book's language. The count is the book's own description,
 * so quiet mode keeps it.
 */
export function bookClosingPageLines(book: Pick<Book, 'chapters' | 'generatedAt' | 'language'>): string[] {
  const copy = bookCopy(book.language);
  const date = (day: string) => formatBookDate(day, book.language);
  const entries = new Set(book.chapters.flatMap((chapter) => chapter.entries.map((entry) => entry.id ?? entry)));
  const dates = book.chapters.flatMap((chapter) => chapter.entries.map((entry) => entry.date)).sort();
  const first = dates[0];
  const last = dates.at(-1);
  const lines: string[] = [];
  if (first && last) {
    lines.push(first === last ? copy.entriesOn(date(first)) : copy.entriesBetween(date(first), date(last)));
  }
  lines.push(formatBookEntryCount(entries.size, book.language), copy.madeOn(date(book.generatedAt)));
  return lines;
}

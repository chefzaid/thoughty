import type { AppImportEntryRequest } from '../../services/api/appImportService';
import type { TranslationFunction } from '../../types';
import { cleanEntryTitle } from '../../utils/entryTime';
import type { ReadingSection } from './readingBookTypes';
import type { ReadingNote, StoredReadingBook } from './readingNotesStorage';

/** Characters Markdown would read as formatting in a line of the book's own text. */
const INLINE_MARKDOWN = /[\\`*_[\]<>]/g;
/** A line opening with a heading, list, quote or numbered-list marker. */
const BLOCK_MARKER = /^(\s*)([#>+-]|\d+[.)])/;

function escapeMarkdown(text: string): string {
  return text.replaceAll(INLINE_MARKDOWN, (character) => `\\${character}`).replace(BLOCK_MARKER, (_, space: string, marker: string) => `${space}\\${marker}`);
}

/** Where in the book a note was taken, as its list shows it: "Page 12", the chapter's heading, or "Chapter 3". */
export function sectionLabel(section: ReadingSection, t: TranslationFunction): string {
  if (section.kind === 'page') return t('readingNotesPage', { page: section.number });
  return section.heading ?? t('readingNotesChapter', { chapter: section.number });
}

/** The same, as the entry's source line writes it ("page 12", "chapter 3"). */
function sourceLocation(section: ReadingSection, t: TranslationFunction): string {
  if (section.kind === 'page') return t('readingNotesSourcePage', { page: section.number });
  return section.heading ?? t('readingNotesSourceChapter', { chapter: section.number });
}

/**
 * The entry a note becomes: the passage as a Markdown quote of the book's words (escaped so they read
 * as written), the writer's note as they wrote it, then where it comes from (title, author, page or
 * chapter). Titled after the book, on the day and at the time the note was taken.
 */
export function readingNoteEntry(
  fingerprint: string,
  book: Pick<StoredReadingBook, 'title' | 'author'>,
  note: ReadingNote,
  t: TranslationFunction,
): AppImportEntryRequest {
  const quote = note.quote.trim()
    ? note.quote.trim().split(/\r?\n/).map((line) => (line.trim() ? `> ${escapeMarkdown(line.trim())}` : '>')).join('\n')
    : null;
  const source = [`*${escapeMarkdown(book.title)}*`, book.author ? escapeMarkdown(book.author) : null, escapeMarkdown(sourceLocation(note.section, t))]
    .filter(Boolean)
    .join(', ');
  const content = [quote, note.note.trim() || null, `— ${source}`].filter(Boolean).join('\n\n');
  return {
    sourceId: `${fingerprint}/${note.id}`,
    date: note.date,
    timeOfDay: note.timeOfDay,
    title: cleanEntryTitle(book.title) ?? undefined,
    content,
    tags: [],
  };
}

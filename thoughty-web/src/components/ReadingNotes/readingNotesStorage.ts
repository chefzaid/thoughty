import type { ReadingSection } from './readingBookTypes';

/** A note taken while reading: the passage it is about (may be empty) and what the writer thought. */
export interface ReadingNote {
  /** A random UUID; with the book's fingerprint it is the entry's source ID, so a note is never saved twice. */
  readonly id: string;
  readonly quote: string;
  readonly note: string;
  readonly section: ReadingSection;
  /** The writer's day and time the note was taken: the entry's day and time of day. */
  readonly date: string;
  readonly timeOfDay: string;
}

/** A book's notes not saved to the journal yet, with what is needed to name it without the file. */
export interface StoredReadingBook {
  readonly title: string;
  readonly author: string | null;
  readonly notes: readonly ReadingNote[];
}

/** By the book's fingerprint. */
export type ReadingNotesStore = Readonly<Record<string, StoredReadingBook>>;

export const MAX_QUOTE_LENGTH = 5_000;
export const MAX_NOTE_LENGTH = 20_000;

/**
 * This device's notes not saved to the journal yet, one key per writer. They are private text, so they
 * go when the writer signs out (`forgetLocalReadingNotes`), as the composer draft's copy does.
 */
const STORAGE_PREFIX = 'thoughty.readingNotes.';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const isText = (value: unknown, maxLength: number): value is string => typeof value === 'string' && value.length <= maxLength;

function isSection(value: unknown): value is ReadingSection {
  if (!value || typeof value !== 'object') return false;
  const section = value as Record<string, unknown>;
  return (section.kind === 'page' || section.kind === 'chapter')
    && Number.isInteger(section.number) && (section.number as number) > 0
    && (section.heading === null || typeof section.heading === 'string');
}

function isNote(value: unknown): value is ReadingNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === 'string' && /^[0-9a-f-]{36}$/.test(note.id)
    && isText(note.quote, MAX_QUOTE_LENGTH) && isText(note.note, MAX_NOTE_LENGTH)
    && isSection(note.section)
    && typeof note.date === 'string' && DAY.test(note.date)
    && typeof note.timeOfDay === 'string' && TIME.test(note.timeOfDay);
}

function readBook(value: unknown): StoredReadingBook | null {
  if (!value || typeof value !== 'object') return null;
  const book = value as Record<string, unknown>;
  if (typeof book.title !== 'string' || !(book.author === null || typeof book.author === 'string') || !Array.isArray(book.notes)) return null;
  const notes = book.notes.filter(isNote);
  return notes.length > 0 ? { title: book.title, author: book.author, notes } : null;
}

export function loadReadingNotes(userId: number): ReadingNotesStore {
  try {
    const raw = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}${userId}`);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed)
      .filter(([fingerprint]) => /^[0-9a-f]{16}$/.test(fingerprint))
      .map(([fingerprint, book]) => [fingerprint, readBook(book)] as const)
      .filter((pair): pair is readonly [string, StoredReadingBook] => pair[1] !== null));
  } catch {
    return {};
  }
}

/** Keeps the store on this device; a store without notes leaves nothing behind. */
export function storeReadingNotes(userId: number, store: ReadingNotesStore): void {
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const kept = Object.fromEntries(Object.entries(store).filter(([, book]) => book.notes.length > 0));
    if (Object.keys(kept).length === 0) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, JSON.stringify(kept));
    }
  } catch {
    // Blocked or full storage: the notes stay for this visit only
  }
}

/** Removes every writer's unsaved reading notes from this device, as the writer signs out. */
export function forgetLocalReadingNotes(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key?.startsWith(STORAGE_PREFIX) ?? false)
      .forEach((key) => storage.removeItem(key));
  } catch {
    // Nothing to remove when storage is blocked
  }
}

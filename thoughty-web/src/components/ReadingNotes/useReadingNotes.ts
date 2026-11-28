import { useCallback, useEffect, useState } from 'react';

import type { createAppImportService } from '../../services/api/appImportService';
import type { TranslationFunction } from '../../types';
import { writersToday } from '../../utils/entryDate';
import { currentTimeOfDay } from '../../utils/entryTime';
import type { ReadingSection } from './readingBookTypes';
import { readingNoteEntry } from './readingNoteEntry';
import {
  loadReadingNotes,
  MAX_NOTE_LENGTH,
  MAX_QUOTE_LENGTH,
  storeReadingNotes,
  type ReadingNote,
  type ReadingNotesStore,
  type StoredReadingBook,
} from './readingNotesStorage';

/** As many notes as the import route takes in one request. */
const NOTES_PER_REQUEST = 200;

export type ReadingNotesService = Pick<ReturnType<typeof createAppImportService>, 'importEntries'>;
export type ReadingBookInfo = Pick<StoredReadingBook, 'title' | 'author'>;
export type SaveNotesResult = { readonly ok: true; readonly saved: number } | { readonly ok: false; readonly saved: number; readonly error: string };

export interface ReadingNotesApi {
  readonly store: ReadingNotesStore;
  addNote(fingerprint: string, book: ReadingBookInfo, fields: { quote: string; note: string; section: ReadingSection }): void;
  updateNote(fingerprint: string, id: string, fields: { quote: string; note: string }): void;
  removeNote(fingerprint: string, id: string): void;
  discardBook(fingerprint: string): void;
  /** Saves the book's notes as private entries in the diary, then keeps only those that could not be saved. */
  saveBook(fingerprint: string, diaryId: number | null | undefined): Promise<SaveNotesResult>;
}

const clip = (text: string, maxLength: number) => text.slice(0, maxLength);

/** The writer's unsaved reading notes on this device, kept in step with its storage. */
export function useReadingNotes(userId: number | null, service: ReadingNotesService, t: TranslationFunction): ReadingNotesApi {
  const [store, setStore] = useState<ReadingNotesStore>(() => (userId === null ? {} : loadReadingNotes(userId)));
  useEffect(() => {
    setStore(userId === null ? {} : loadReadingNotes(userId));
  }, [userId]);

  const change = useCallback((update: (current: ReadingNotesStore) => ReadingNotesStore) => {
    setStore((current) => {
      const next = update(current);
      if (userId !== null) storeReadingNotes(userId, next);
      return next;
    });
  }, [userId]);

  const changeNotes = useCallback((fingerprint: string, update: (notes: readonly ReadingNote[]) => readonly ReadingNote[], book?: ReadingBookInfo) => {
    change((current) => {
      const existing = current[fingerprint];
      const info = existing ?? book;
      if (!info) return current;
      const { [fingerprint]: _, ...others } = current;
      const notes = update(existing?.notes ?? []);
      return notes.length > 0 ? { ...others, [fingerprint]: { title: info.title, author: info.author, notes } } : others;
    });
  }, [change]);

  const addNote = useCallback<ReadingNotesApi['addNote']>((fingerprint, book, fields) => {
    const now = new Date();
    const note: ReadingNote = {
      id: crypto.randomUUID(),
      quote: clip(fields.quote.trim(), MAX_QUOTE_LENGTH),
      note: clip(fields.note.trim(), MAX_NOTE_LENGTH),
      section: fields.section,
      date: writersToday(now),
      timeOfDay: currentTimeOfDay(now),
    };
    changeNotes(fingerprint, (notes) => [...notes, note], book);
  }, [changeNotes]);

  const updateNote = useCallback<ReadingNotesApi['updateNote']>((fingerprint, id, fields) => {
    changeNotes(fingerprint, (notes) => notes.map((note) => (note.id === id
      ? { ...note, quote: clip(fields.quote.trim(), MAX_QUOTE_LENGTH), note: clip(fields.note.trim(), MAX_NOTE_LENGTH) }
      : note)));
  }, [changeNotes]);

  const removeNote = useCallback<ReadingNotesApi['removeNote']>((fingerprint, id) => {
    changeNotes(fingerprint, (notes) => notes.filter((note) => note.id !== id));
  }, [changeNotes]);

  const discardBook = useCallback((fingerprint: string) => {
    changeNotes(fingerprint, () => []);
  }, [changeNotes]);

  const saveBook = useCallback<ReadingNotesApi['saveBook']>(async (fingerprint, diaryId) => {
    const book = store[fingerprint];
    if (!book) return { ok: true, saved: 0 };
    let saved = 0;
    for (let start = 0; start < book.notes.length; start += NOTES_PER_REQUEST) {
      const batch = book.notes.slice(start, start + NOTES_PER_REQUEST);
      const result = await service.importEntries({
        source: 'reading-notes',
        diaryId: diaryId ?? undefined,
        entries: batch.map((note) => readingNoteEntry(fingerprint, book, note, t)),
      });
      if (!result.ok) return { ok: false, saved, error: result.error };
      // A note already saved by an interrupted attempt is in the journal too: it leaves this device all the same
      const savedIds = new Set(batch.map((note) => note.id));
      changeNotes(fingerprint, (notes) => notes.filter((note) => !savedIds.has(note.id)));
      saved += batch.length;
    }
    return { ok: true, saved };
  }, [changeNotes, service, store, t]);

  return { store, addNote, updateNote, removeNote, discardBook, saveBook };
}

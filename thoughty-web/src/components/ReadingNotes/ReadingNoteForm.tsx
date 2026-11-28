import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import type { TranslationFunction } from '../../types';
import { MAX_NOTE_LENGTH, MAX_QUOTE_LENGTH } from './readingNotesStorage';

/** Writes a new note, or changes one: the passage (prefilled from the selection) and the writer's thought. */
export function ReadingNoteForm({
  initialQuote,
  initialNote = '',
  location,
  editing,
  onSave,
  onCancel,
  t,
}: Readonly<{
  initialQuote: string;
  initialNote?: string;
  /** Where in the book the note is, e.g. "Page 12". */
  location: string;
  editing: boolean;
  onSave: (fields: { quote: string; note: string }) => void;
  onCancel: () => void;
  t: TranslationFunction;
}>) {
  const [quote, setQuote] = useState(initialQuote);
  const [note, setNote] = useState(initialNote);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const quoteId = useId();
  const noteId = useId();
  const empty = !quote.trim() && !note.trim();

  useEffect(() => {
    noteRef.current?.focus();
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!empty) onSave({ quote, note });
  };

  return (
    <form className="reading-note-form" onSubmit={handleSubmit} aria-label={t(editing ? 'readingNotesEditTitle' : 'readingNotesNewTitle')}>
      <p className="reading-note-form__location">{location}</p>
      <label htmlFor={quoteId}>{t('readingNotesPassage')}</label>
      <textarea
        id={quoteId}
        className="privacy-text"
        rows={3}
        value={quote}
        maxLength={MAX_QUOTE_LENGTH}
        onChange={(event) => setQuote(event.target.value)}
      />
      <label htmlFor={noteId}>{t('readingNotesYourNote')}</label>
      <textarea
        ref={noteRef}
        id={noteId}
        className="privacy-text"
        rows={4}
        value={note}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="reading-note-form__actions">
        <button type="submit" className="io-btn primary" disabled={empty}>{t('readingNotesKeepNote')}</button>
        <button type="button" className="io-btn secondary" onClick={onCancel}>{t('cancel')}</button>
      </div>
    </form>
  );
}

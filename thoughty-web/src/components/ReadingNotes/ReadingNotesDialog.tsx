import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import type { ReadingBook } from './readingBookTypes';
import { sectionLabel } from './readingNoteEntry';
import type { ReadingNote } from './readingNotesStorage';
import { ReadingNoteForm } from './ReadingNoteForm';
import { ReadingNotesList } from './ReadingNotesList';
import { useSectionText, useSelectedText } from './useReadingSelection';
import type { ReadingNotesApi } from './useReadingNotes';

type Draft = { readonly quote: string; readonly editing: ReadingNote | null };

/**
 * The book open for reading, a page or chapter at a time as plain text, with the notes taken on it
 * beside it: select a passage, add a note on it (or on the page), and save them all to the journal.
 * The modal keeps focus inside, Escape or Close leaves it (the notes stay on this device).
 */
export function ReadingNotesDialog({
  book,
  notes,
  diaryLabel,
  saving,
  status,
  isLight,
  language,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
  onSave,
  onClose,
  t,
}: Readonly<{
  book: ReadingBook;
  notes: readonly ReadingNote[];
  diaryLabel: string;
  saving: boolean;
  /** What the last save did, or why it failed. */
  status: { readonly kind: 'success' | 'error'; readonly text: string } | null;
  isLight: boolean;
  language: Language;
  onAddNote: (fields: Parameters<ReadingNotesApi['addNote']>[2]) => void;
  onUpdateNote: (id: string, fields: { quote: string; note: string }) => void;
  onRemoveNote: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
  t: TranslationFunction;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const notesTitleId = useId();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const { paragraphs, failed } = useSectionText(book, index);
  const selected = useSelectedText(textRef);
  const section = book.sections[index]!;
  const lastIndex = book.sections.length - 1;

  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: closeButtonRef, onClose });

  const goTo = (next: number) => {
    setIndex(Math.min(Math.max(next, 0), lastIndex));
    textRef.current?.scrollTo?.({ top: 0 });
  };
  const handleTextKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const moves: Record<string, number> = { ArrowLeft: index - 1, PageUp: index - 1, ArrowRight: index + 1, PageDown: index + 1 };
    if (moves[event.key] === undefined) return;
    event.preventDefault();
    goTo(moves[event.key]!);
  };
  const saveDraft = (fields: { quote: string; note: string }) => {
    if (draft?.editing) onUpdateNote(draft.editing.id, fields);
    else onAddNote({ ...fields, section });
    setDraft(null);
  };

  let text = <p className="reading-dialog__empty">{t('readingNotesNoText')}</p>;
  if (paragraphs === null) {
    text = (
      <p className="reading-dialog__empty" role="status">
        <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" /> {t('readingNotesLoadingPage')}
      </p>
    );
  } else if (failed) {
    text = <p className="reading-dialog__empty" role="alert">{t('readingNotesPageError')}</p>;
  } else if (paragraphs.length > 0) {
    text = <>{paragraphs.map((paragraph, position) => <p key={position}>{paragraph}</p>)}</>;
  }

  return createPortal(
    <div className={`reading-backdrop ${isLight ? 'reading--light' : 'reading--dark'}`}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="reading-dialog">
        <div className="reading-dialog__header">
          <div className="reading-dialog__heading">
            <h2 id={titleId} className="reading-dialog__title">{book.title}</h2>
            {book.author && <p className="reading-dialog__author">{book.author}</p>}
          </div>
          <button ref={closeButtonRef} type="button" className="io-btn secondary" onClick={onClose}>{t('close')}</button>
        </div>

        <div className="reading-dialog__body">
          <div className="reading-dialog__reader">
            <nav className="reading-dialog__nav" aria-label={t('readingNotesNavigation')}>
              <button type="button" className="io-btn secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
                {t(section.kind === 'page' ? 'readingNotesPreviousPage' : 'readingNotesPreviousChapter')}
              </button>
              <select aria-label={t('readingNotesGoTo')} value={index} onChange={(event) => goTo(Number(event.target.value))}>
                {book.sections.map((item, position) => <option key={position} value={position}>{sectionLabel(item, t)}</option>)}
              </select>
              <button type="button" className="io-btn secondary" onClick={() => goTo(index + 1)} disabled={index === lastIndex}>
                {t(section.kind === 'page' ? 'readingNotesNextPage' : 'readingNotesNextChapter')}
              </button>
            </nav>
            <div
              ref={textRef}
              className="reading-dialog__text"
              role="region"
              aria-label={sectionLabel(section, t)}
              tabIndex={0}
              onKeyDown={handleTextKeyDown}
            >
              {text}
            </div>
            <div className="reading-dialog__add">
              <button
                type="button"
                className="io-btn primary"
                // Keeps the selection: pressing the button would otherwise clear it before the click
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setDraft({ quote: selected, editing: null })}
              >
                {t(selected ? 'readingNotesAddOnPassage' : 'readingNotesAdd')}
              </button>
              <p className="reading-dialog__hint">{t('readingNotesSelectHint')}</p>
            </div>
          </div>

          <section className="reading-dialog__notes" aria-labelledby={notesTitleId}>
            <h3 id={notesTitleId}>{pluralPhrase(t, 'readingNotesCount', notes.length, language)}</h3>
            {draft && (
              <ReadingNoteForm
                key={draft.editing?.id ?? `new-${draft.quote}`}
                initialQuote={draft.editing?.quote ?? draft.quote}
                initialNote={draft.editing?.note}
                location={sectionLabel(draft.editing?.section ?? section, t)}
                editing={draft.editing !== null}
                onSave={saveDraft}
                onCancel={() => setDraft(null)}
                t={t}
              />
            )}
            <ReadingNotesList
              notes={notes}
              labelledBy={notesTitleId}
              onGoTo={(note) => goTo(note.section.number - 1)}
              onEdit={(note) => setDraft({ quote: note.quote, editing: note })}
              onRemove={(note) => onRemoveNote(note.id)}
              t={t}
            />
            <div className="reading-dialog__save">
              <button type="button" className="io-btn primary" onClick={onSave} disabled={notes.length === 0 || saving}>
                {saving ? t('readingNotesSaving') : t('readingNotesSave', { diaryName: diaryLabel })}
              </button>
              <p className="reading-dialog__hint">{t('readingNotesSaveHint')}</p>
              {status && <p className={`message ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>{status.text}</p>}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

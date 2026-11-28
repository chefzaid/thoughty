import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createAppImportService } from '../../services/api/appImportService';
import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { openReadingBook } from './readingBook';
import { ReadingBookError, type ReadingBook, type ReadingBookProblem } from './readingBookTypes';
import { ReadingNotesDialog } from './ReadingNotesDialog';
import { useReadingNotes } from './useReadingNotes';
import './ReadingNotes.css';

const PROBLEM_KEYS: Record<ReadingBookProblem, string> = {
  unsupported: 'readingNotesUnsupported',
  tooLarge: 'readingNotesTooLarge',
  damaged: 'readingNotesDamaged',
  protected: 'readingNotesProtected',
  empty: 'readingNotesEmptyBook',
};

type Opened =
  | { readonly step: 'idle' }
  | { readonly step: 'opening'; readonly fileName: string }
  | { readonly step: 'failed'; readonly reason: ReadingBookProblem }
  | { readonly step: 'open'; readonly book: ReadingBook };
type Status = { readonly kind: 'success' | 'error'; readonly text: string };

/**
 * Reading notes: a PDF or EPUB opened on this device (never uploaded) to read and annotate, each
 * note then saved as a private entry in the page's diary. Notes not saved yet wait on this device,
 * listed here by book, until they are saved or discarded.
 */
export function ReadingNotesPanel({
  diaryId,
  diaryName,
  isLight,
  language,
  t,
}: Readonly<{ diaryId?: number | null; diaryName?: string; isLight: boolean; language: Language; t: TranslationFunction }>) {
  const { user } = useAuth();
  const service = useAuthenticatedService(createAppImportService);
  const notes = useReadingNotes(user?.id ?? null, service, t);
  const [opened, setOpened] = useState<Opened>({ step: 'idle' });
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const openedRef = useRef(opened);
  const diaryLabel = diaryId && diaryName ? diaryName : t('appImportDefaultDiary');
  const pending = Object.entries(notes.store);

  useEffect(() => {
    openedRef.current = opened;
  }, [opened]);
  // A book still open when the page goes frees what PDF.js holds for it
  useEffect(() => () => {
    if (openedRef.current.step === 'open') void openedRef.current.book.destroy();
  }, []);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setStatus(null);
    setOpened({ step: 'opening', fileName: file.name });
    try {
      setOpened({ step: 'open', book: await openReadingBook(file) });
    } catch (error) {
      setOpened({ step: 'failed', reason: error instanceof ReadingBookError ? error.reason : 'damaged' });
    }
  };

  const closeBook = () => {
    if (opened.step === 'open') void opened.book.destroy();
    setOpened({ step: 'idle' });
  };

  const save = async (fingerprint: string) => {
    setSaving(fingerprint);
    setStatus(null);
    const result = await notes.saveBook(fingerprint, diaryId);
    setSaving(null);
    if (result.ok) {
      setStatus({ kind: 'success', text: pluralPhrase(t, 'readingNotesSaved', result.saved, language, { diaryName: diaryLabel }) });
    } else {
      setStatus({ kind: 'error', text: t('readingNotesSaveFailed', { error: t(result.error) }) });
    }
  };

  const openBook = opened.step === 'open' ? opened.book : null;
  return (
    <section className="app-import reading-notes" aria-labelledby="reading-notes-title">
      <h3 id="reading-notes-title">{t('readingNotesTitle')}</h3>
      <p className="section-description">{t('readingNotesDescription', { diaryName: diaryLabel })}</p>
      <div className="file-upload app-import-file">
        <input type="file" id="reading-notes-file" className="app-import-input" accept=".pdf,.epub,application/pdf,application/epub+zip" onChange={handleFile} />
        <label htmlFor="reading-notes-file" className="file-label">
          <span className="codicon codicon-book" aria-hidden="true" />
          {t('readingNotesOpen')}
        </label>
      </div>
      {opened.step === 'opening' && <p className="app-import-note" role="status">{t('readingNotesOpening', { name: opened.fileName })}</p>}
      {opened.step === 'failed' && <p className="message error" role="alert">{t(PROBLEM_KEYS[opened.reason])}</p>}
      {!openBook && status && <p className={`message ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>{status.text}</p>}

      {pending.length > 0 && (
        <div className="reading-notes__pending">
          <p className="app-import-heading" id="reading-notes-pending">{t('readingNotesPending')}</p>
          <ul aria-labelledby="reading-notes-pending">
            {pending.map(([fingerprint, book]) => (
              <li key={fingerprint}>
                <span className="reading-notes__book">
                  <strong>{book.title}</strong> · {pluralPhrase(t, 'readingNotesCount', book.notes.length, language)}
                </span>
                <span className="reading-notes__actions">
                  <button type="button" className="io-btn primary" disabled={saving !== null} onClick={() => void save(fingerprint)}>
                    {saving === fingerprint ? t('readingNotesSaving') : t('readingNotesSaveShort')}
                  </button>
                  <button type="button" className="io-btn secondary" disabled={saving !== null} onClick={() => setDiscarding(fingerprint)}>
                    {t('readingNotesDiscard')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openBook && (
        <ReadingNotesDialog
          book={openBook}
          notes={notes.store[openBook.fingerprint]?.notes ?? []}
          diaryLabel={diaryLabel}
          saving={saving === openBook.fingerprint}
          status={status}
          isLight={isLight}
          language={language}
          onAddNote={(fields) => {
            setStatus(null);
            notes.addNote(openBook.fingerprint, { title: openBook.title, author: openBook.author }, fields);
          }}
          onUpdateNote={(id, fields) => notes.updateNote(openBook.fingerprint, id, fields)}
          onRemoveNote={(id) => notes.removeNote(openBook.fingerprint, id)}
          onSave={() => void save(openBook.fingerprint)}
          onClose={closeBook}
          t={t}
        />
      )}
      <ConfirmModal
        isOpen={discarding !== null}
        onClose={() => setDiscarding(null)}
        onConfirm={() => {
          if (discarding) notes.discardBook(discarding);
          setDiscarding(null);
        }}
        title={t('readingNotesDiscardTitle')}
        message={t('readingNotesDiscardMessage', { title: (discarding && notes.store[discarding]?.title) || '' })}
        confirmLabel={t('readingNotesDiscard')}
        theme={isLight ? 'light' : 'dark'}
        t={t}
      />
    </section>
  );
}

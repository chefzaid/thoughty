import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { SavedSearch } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import { describeSavedSearch, toSavedSearchFilters } from '../../utils/savedSearches';
import SavedSearchList from './SavedSearchList';
import { useSavedSearches } from './useSavedSearches';
import { useSavedSearchRoute, type SavedSearchFilterControls } from './useSavedSearchRoute';

interface SavedSearchesProps {
  readonly filters: SavedSearchFilterControls;
  readonly currentDiaryId: number | null;
  readonly diaries: readonly Pick<Diary, 'id' | 'name'>[];
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
  /** Shows a message in the app's notice toast. */
  readonly notify: (message: string) => void;
}

const MAX_NAME_LENGTH = 80;

/** The filter bar's saved searches: a button that names the one shown, and a dialog to save, show, rename and delete them. */
function SavedSearches({ filters, currentDiaryId, diaries, theme, t, notify }: SavedSearchesProps) {
  const { list, create, rename, remove } = useSavedSearches();
  const savedSearches = list.data?.savedSearches;
  const limit = list.data?.limit ?? 0;
  const { shownSearch, applySavedSearch, markSavedSearchShown } = useSavedSearchRoute({ savedSearches, filters, currentDiaryId, notify, t });

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [pendingDelete, setPendingDelete] = useState<SavedSearch | null>(null);
  const [focusNameInput, setFocusNameInput] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const introId = useId();
  const nameId = useId();
  const nameHelpId = useId();
  const nameErrorId = useId();
  const isLight = theme === 'light';
  const isFull = savedSearches !== undefined && savedSearches.length >= limit;

  useDialogFocus({ isOpen, dialogRef, initialFocusRef: closeRef, onClose: () => setIsOpen(false), returnFocusRef: triggerRef });

  useEffect(() => {
    if (!focusNameInput) return;
    nameInputRef.current?.focus();
    setFocusNameInput(false);
  }, [focusNameInput, savedSearches]);

  const open = () => {
    setStatus('');
    setSaveError(null);
    setIsOpen(true);
  };

  const show = (saved: SavedSearch) => {
    applySavedSearch(saved);
    setIsOpen(false);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setSaveError(t('savedSearchNameRequired'));
      nameInputRef.current?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await create({ name: trimmed, diaryId: currentDiaryId, filters: toSavedSearchFilters(filters) });
    setSaving(false);
    if (!result.data) {
      setSaveError(t(result.error ?? 'savedSearchSaveFailed'));
      return;
    }
    setName('');
    setStatus(t('savedSearchSaved', { name: result.data.name }));
    markSavedSearchShown(result.data);
  };

  const submitRename = async (saved: SavedSearch, nextName: string): Promise<string | null> => {
    const result = await rename(saved.id, nextName);
    if (!result.data) return t(result.error ?? 'savedSearchRenameFailed');
    setStatus(t('savedSearchRenamed', { name: result.data.name }));
    return null;
  };

  const confirmDelete = async () => {
    const saved = pendingDelete;
    setPendingDelete(null);
    if (!saved) return;
    const result = await remove(saved.id);
    setStatus(result.data ? t('savedSearchDeleted', { name: saved.name }) : t(result.error ?? 'savedSearchDeleteFailed'));
    setFocusNameInput(true);
  };

  const triggerLabel = shownSearch ? t('savedSearchesShowing', { name: shownSearch.name }) : t('savedSearches');
  const muted = isLight ? 'text-gray-600' : 'text-gray-400';
  const errorText = isLight ? 'text-red-700' : 'text-red-300';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`flex h-10 max-w-[16rem] shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all ${shownSearch
          ? `border-blue-500/60 bg-blue-500/10 ${isLight ? 'text-blue-800' : 'text-blue-200'} hover:bg-blue-500/20`
          : isLight ? 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100' : 'border-gray-600 bg-gray-900 text-gray-300 hover:bg-gray-800'}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={triggerLabel}
        onClick={open}
      >
        <span className={`codicon ${shownSearch ? 'codicon-bookmark' : 'codicon-search-save'}`} aria-hidden="true" />
        <span className="truncate">{shownSearch ? triggerLabel : t('savedSearches')}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
          <button
            type="button"
            className="fixed inset-0 cursor-default bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={introId}
            className={`relative z-10 mt-12 flex w-full max-w-lg flex-col gap-4 rounded-xl border p-5 shadow-2xl ${isLight
              ? 'border-gray-200 bg-white text-gray-900'
              : 'border-gray-700 bg-gray-800 text-gray-100'}`}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-lg font-semibold">{t('savedSearches')}</h2>
                <p id={introId} className={`mt-1 text-sm ${muted}`}>{t('savedSearchesIntro')}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-700'}`}
                aria-label={t('close')}
                title={t('close')}
                onClick={() => setIsOpen(false)}
              >
                <span className="codicon codicon-close" aria-hidden="true" />
              </button>
            </header>

            <section aria-labelledby={titleId}>
              {list.isPending && <p className={`text-sm ${muted}`}>{t('savedSearchesLoading')}</p>}
              {list.isError && (
                <div role="alert" className={`flex flex-wrap items-center gap-3 text-sm ${errorText}`}>
                  <p>{t('savedSearchesLoadFailed')}</p>
                  <button type="button" className="underline" onClick={() => void list.refetch()}>{t('tryAgain')}</button>
                </div>
              )}
              {savedSearches?.length === 0 && <p className={`text-sm ${muted}`}>{t('savedSearchesEmpty')}</p>}
              {savedSearches && savedSearches.length > 0 && (
                <SavedSearchList
                  savedSearches={savedSearches}
                  shownSearchId={shownSearch?.id ?? null}
                  diaries={diaries}
                  isLight={isLight}
                  t={t}
                  onApply={show}
                  onRename={submitRename}
                  onDelete={setPendingDelete}
                />
              )}
            </section>

            {savedSearches && (
              <form className={`flex flex-col gap-2 border-t pt-4 ${isLight ? 'border-gray-200' : 'border-gray-700'}`} onSubmit={(event) => void save(event)}>
                <label htmlFor={nameId} className="text-sm font-medium">{t('savedSearchName')}</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={nameInputRef}
                    id={nameId}
                    type="text"
                    className={`h-10 min-w-0 flex-1 basis-48 rounded-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isLight
                      ? 'border-gray-300 bg-gray-50 text-gray-900'
                      : 'border-gray-700 bg-gray-900 text-gray-100'}`}
                    value={name}
                    maxLength={MAX_NAME_LENGTH}
                    disabled={isFull}
                    aria-invalid={saveError ? true : undefined}
                    aria-describedby={[nameHelpId, saveError ? nameErrorId : ''].filter(Boolean).join(' ')}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={saving || isFull}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="codicon codicon-save" aria-hidden="true" />
                    {t('savedSearchSaveCurrent')}
                  </button>
                </div>
                <div id={nameHelpId} className={`text-xs ${muted}`}>
                  <p>{t('savedSearchWillSave', { summary: describeSavedSearch(toSavedSearchFilters(filters), currentDiaryId, diaries, t) })}</p>
                  <p>
                    {isFull
                      ? t('savedSearchLimitReached', { limit })
                      : t('savedSearchCount', { count: savedSearches.length, limit })}
                  </p>
                </div>
                {saveError && <p id={nameErrorId} role="alert" className={`text-sm ${errorText}`}>{saveError}</p>}
              </form>
            )}

            <p role="status" aria-live="polite" className={`min-h-5 text-sm ${muted}`}>{status}</p>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={t('savedSearchDeleteTitle')}
        message={t('savedSearchDeleteMessage', { name: pendingDelete?.name ?? '' })}
        theme={theme}
        t={t}
      />
    </>
  );
}

export default SavedSearches;

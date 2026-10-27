import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { LifeEra, SavedSearch } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import { describeSavedSearch } from '../../utils/savedSearches';

interface SavedSearchListProps {
  readonly savedSearches: readonly SavedSearch[];
  readonly shownSearchId: number | null;
  readonly diaries: readonly Pick<Diary, 'id' | 'name'>[];
  readonly eras: readonly LifeEra[];
  readonly isLight: boolean;
  readonly t: TranslationFunction;
  readonly onApply: (saved: SavedSearch) => void;
  /** Resolves to an error to show, or null once renamed. */
  readonly onRename: (saved: SavedSearch, name: string) => Promise<string | null>;
  readonly onDelete: (saved: SavedSearch) => void;
}

const MAX_NAME_LENGTH = 80;

/** The saved searches, each shown in one click, renamed in place or deleted. */
function SavedSearchList({ savedSearches, shownSearchId, diaries, eras, isLight, t, onApply, onRename, onDelete }: SavedSearchListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const muted = isLight ? 'text-gray-600' : 'text-gray-400';
  const outlined = isLight
    ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
    : 'border-gray-600 bg-gray-900 text-gray-300 hover:bg-gray-700';
  const iconButton = `grid h-9 w-9 shrink-0 place-items-center rounded-md border ${outlined}`;

  useEffect(() => {
    if (!focusRequest) return;
    listRef.current?.querySelector<HTMLElement>(focusRequest)?.focus();
    setFocusRequest(null);
  }, [focusRequest, savedSearches]);

  const startRename = (saved: SavedSearch) => {
    setEditingId(saved.id);
    setDraftName(saved.name);
    setRenameError(null);
    setFocusRequest(`[data-saved-search-rename-input="${saved.id}"]`);
  };

  const stopRename = (id: number) => {
    setEditingId(null);
    setRenameError(null);
    setFocusRequest(`[data-saved-search-rename="${id}"]`);
  };

  const submitRename = async (event: FormEvent, saved: SavedSearch) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) {
      setRenameError(t('savedSearchNameRequired'));
      return;
    }
    setRenaming(true);
    const error = name === saved.name ? null : await onRename(saved, name);
    setRenaming(false);
    if (error) {
      setRenameError(error);
      return;
    }
    stopRename(saved.id);
  };

  return (
    <ul ref={listRef} className="flex flex-col gap-2">
      {savedSearches.map((saved) => {
        const nameId = `saved-search-name-${saved.id}`;
        const summaryId = `saved-search-summary-${saved.id}`;
        const errorId = `saved-search-rename-error-${saved.id}`;
        const shown = saved.id === shownSearchId;
        return (
          <li
            key={saved.id}
            className={`rounded-lg border p-2 ${shown
              ? 'border-blue-500/60 bg-blue-500/10'
              : isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-900/60'}`}
          >
            {editingId === saved.id ? (
              <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => void submitRename(event, saved)}>
                <input
                  type="text"
                  data-saved-search-rename-input={saved.id}
                  className={`h-9 min-w-0 flex-1 basis-40 rounded-md border px-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isLight
                    ? 'border-gray-300 bg-white text-gray-900'
                    : 'border-gray-600 bg-gray-900 text-gray-100'}`}
                  value={draftName}
                  maxLength={MAX_NAME_LENGTH}
                  aria-label={t('savedSearchNewName', { name: saved.name })}
                  aria-invalid={renameError ? true : undefined}
                  aria-describedby={renameError ? errorId : undefined}
                  onChange={(event) => setDraftName(event.target.value)}
                />
                <button type="submit" disabled={renaming} className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {t('savedSearchRenameSave')}
                </button>
                <button type="button" className={`h-9 rounded-md border px-3 text-sm ${outlined}`} onClick={() => stopRename(saved.id)}>
                  {t('cancel')}
                </button>
                {renameError && (
                  <p id={errorId} role="alert" className={`basis-full text-sm ${isLight ? 'text-red-700' : 'text-red-300'}`}>{renameError}</p>
                )}
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-saved-search-apply={saved.id}
                  className={`min-w-0 flex-1 rounded-md px-2 py-1 text-left ${isLight ? 'hover:bg-gray-200/70' : 'hover:bg-gray-700/60'}`}
                  aria-labelledby={nameId}
                  aria-describedby={summaryId}
                  aria-current={shown ? 'true' : undefined}
                  onClick={() => onApply(saved)}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span id={nameId} className="min-w-0 break-words">{saved.name}</span>
                    {shown && (
                      <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                        {t('savedSearchShowingBadge')}
                      </span>
                    )}
                  </span>
                  <span id={summaryId} className={`block break-words text-xs ${muted}`}>
                    {describeSavedSearch(saved.filters, saved.diaryId, diaries, t, eras)}
                  </span>
                </button>
                <button
                  type="button"
                  data-saved-search-rename={saved.id}
                  className={iconButton}
                  aria-label={t('savedSearchRename', { name: saved.name })}
                  title={t('savedSearchRename', { name: saved.name })}
                  onClick={() => startRename(saved)}
                >
                  <span className="codicon codicon-edit" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`${iconButton} hover:text-red-500`}
                  aria-label={t('savedSearchDelete', { name: saved.name })}
                  title={t('savedSearchDelete', { name: saved.name })}
                  onClick={() => onDelete(saved)}
                >
                  <span className="codicon codicon-trash" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default SavedSearchList;

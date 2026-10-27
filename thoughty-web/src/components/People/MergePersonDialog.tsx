import { useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { Person } from '../../services/api/peopleService';
import type { TranslationFunction } from '../../types';

interface MergePersonDialogProps {
  /** The person kept. */
  readonly person: Person;
  /** Everyone else, who can be merged into the person. */
  readonly candidates: readonly Person[];
  readonly theme: 'light' | 'dark';
  readonly t: TranslationFunction;
  readonly onCancel: () => void;
  /** Resolves an error message to show, or null once merged (the parent then closes the dialog). */
  readonly onMerge: (duplicate: Person) => Promise<string | null>;
}

/** Picks the duplicate to merge into a person, in a modal dialog that says what merging does. */
export default function MergePersonDialog({ person, candidates, theme, t, onCancel, onMerge }: MergePersonDialogProps) {
  const [duplicateId, setDuplicateId] = useState(String(candidates[0]?.id ?? ''));
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const selectId = useId();
  const errorId = useId();
  const isLight = theme === 'light';
  const duplicate = candidates.find((candidate) => String(candidate.id) === duplicateId);

  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: selectRef, onClose: onCancel });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!duplicate || merging) return;
    setMerging(true);
    setError(null);
    const failure = await onMerge(duplicate);
    setMerging(false);
    if (failure) {
      setError(failure);
      selectRef.current?.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop: a pointer target only; keyboard users cancel with Escape or the Cancel button. */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        onClick={onCancel}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`relative z-10 w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl border ${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}
      >
        <h3 id={titleId} className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
          {t('personMergeTitle', { name: person.name })}
        </h3>
        <p id={descriptionId} className={`mb-4 text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
          {t('personMergeDescription', { name: person.name })}
        </p>
        <form noValidate onSubmit={(event) => void submit(event)}>
          <label htmlFor={selectId} className={`block mb-1 text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
            {t('personMergeChoose')}
          </label>
          <select
            ref={selectRef}
            id={selectId}
            value={duplicateId}
            onChange={(event) => setDuplicateId(event.target.value)}
            aria-describedby={error ? errorId : undefined}
            className={`w-full border rounded-lg px-3 h-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${isLight
              ? 'bg-gray-50 border-gray-300 text-gray-900'
              : 'bg-gray-900 border-gray-700 text-gray-100'}`}
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={String(candidate.id)}>
                {`${candidate.name} (${candidate.handles.map((handle) => `@${handle}`).join(', ')})`}
              </option>
            ))}
          </select>
          {error && (
            <p id={errorId} role="alert" className={`mt-2 text-sm ${isLight ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!duplicate || merging}
              className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {merging ? t('personMerging') : t('personMergeConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

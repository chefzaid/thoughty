import { useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction } from '../../types';

interface TemplateNameDialogProps {
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
  readonly onCancel: () => void;
  /**
   * Receives the trimmed name and resolves whether the template was saved; the parent closes the
   * dialog after a save, and the dialog stays open with a message when the save failed.
   */
  readonly onSave: (name: string) => Promise<boolean>;
}

/**
 * Asks for the name of a new entry template in a modal dialog: focus starts in the name field,
 * Tab stays inside, Escape cancels, and an empty name is refused with a message under the field.
 */
function TemplateNameDialog({ theme, t, onCancel, onSave }: TemplateNameDialogProps) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const errorId = useId();
  const isLight = theme === 'light';
  const trimmedName = name.trim();
  const showError = submitted && trimmedName === '';
  let errorMessage: string | null = null;
  if (showError) {
    errorMessage = t('templateNameRequired');
  } else if (saveFailed) {
    errorMessage = t('templateSaveFailed');
  }

  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: inputRef, onClose: onCancel });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The dialog is portaled out of the entry form, but React still bubbles submit to it.
    event.stopPropagation();
    setSubmitted(true);
    if (trimmedName === '') {
      inputRef.current?.focus();
      return;
    }
    if (saving) return;

    setSaving(true);
    setSaveFailed(false);
    try {
      if (!(await onSave(trimmedName))) {
        // The name is kept, so the reader can try again from the field
        setSaveFailed(true);
        inputRef.current?.focus();
      }
    } finally {
      setSaving(false);
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
        className={`relative z-10 w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl border ${
          isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
        }`}
      >
        <h3 id={titleId} className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
          {t('templateNameDialogTitle')}
        </h3>
        <p id={descriptionId} className={`mb-4 text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
          {t('templateNameDialogDescription')}
        </p>
        <form noValidate onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor={inputId} className={`block mb-1 text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
            {t('templateNameLabel')}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            aria-invalid={showError}
            aria-describedby={errorMessage ? errorId : undefined}
            autoComplete="off"
            className={`w-full border rounded-lg px-3 h-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${
              isLight ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'
            } ${showError ? 'border-red-500' : ''}`}
          />
          {errorMessage && (
            <p id={errorId} role="alert" className={`mt-2 text-sm ${isLight ? 'text-red-700' : 'text-red-300'}`}>
              {errorMessage}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? t('templateSaving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default TemplateNameDialog;

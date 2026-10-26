import { useId, useRef } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction } from '../../utils/translations';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** Label of the confirming button; defaults to Delete. */
  confirmLabel?: string;
  theme?: 'light' | 'dark';
  t: TranslationFunction;
}

/**
 * Asks the reader to confirm an action in an alert dialog: focus starts on Cancel, Tab stays
 * inside, Escape cancels, and focus goes back to where it was when the dialog closes.
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  theme = 'dark',
  t,
}: ConfirmModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useDialogFocus({ isOpen, dialogRef, initialFocusRef: cancelButtonRef, onClose });

  if (!isOpen) return null;

  const isLight = theme === 'light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop: a pointer target only; keyboard users cancel with Escape or the Cancel button. */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className={`relative z-10 w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl border ${
          isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
        }`}
      >
        <h3
          id={titleId}
          className={`text-lg font-semibold mb-3 ${
            isLight ? 'text-gray-900' : 'text-gray-100'
          }`}
        >
          {title}
        </h3>
        <p id={messageId} className={`mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{message}</p>
        <div className="flex justify-end gap-3">
          <button type="button"
            ref={cancelButtonRef}
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isLight
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {t('cancel')}
          </button>
          <button type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {confirmLabel ?? t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

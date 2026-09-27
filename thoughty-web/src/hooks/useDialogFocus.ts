import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface DialogFocusOptions {
  readonly isOpen: boolean;
  readonly dialogRef: RefObject<HTMLElement | null>;
  /** Receives focus when the dialog opens, typically its close button. */
  readonly initialFocusRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  /** Where focus goes after closing; defaults to whatever was focused when the dialog opened. */
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Keyboard behavior of a modal dialog: focus moves into the dialog when it opens, Tab and
 * Shift+Tab cycle inside it, Escape closes it, and focus returns to where it came from.
 */
export function useDialogFocus({
  isOpen,
  dialogRef,
  initialFocusRef,
  onClose,
  returnFocusRef,
}: DialogFocusOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnTarget = returnFocusRef?.current ?? previouslyFocused;
    initialFocusRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      const focusIsInside = dialogRef.current?.contains(document.activeElement) ?? false;
      if (event.shiftKey && (document.activeElement === first || !focusIsInside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !focusIsInside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [dialogRef, initialFocusRef, isOpen, returnFocusRef]);
}

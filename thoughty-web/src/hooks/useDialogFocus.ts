import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'audio[controls]',
  'video[controls]',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const GUARD_ATTRIBUTE = 'data-dialog-focus-guard';

/** Open dialogs, oldest first; only the last one (the topmost) handles the keyboard. */
const openDialogs: object[] = [];

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
 * An invisible Tab stop next to the dialog. Focus leaving an embedded document (a PDF or text
 * preview) skips the page's keydown handler, so the next Tab stop in the page catches it instead
 * of letting it reach whatever sits behind the dialog, or leave the page.
 */
function createFocusGuard(edge: 'start' | 'end'): HTMLSpanElement {
  const guard = document.createElement('span');
  guard.setAttribute(GUARD_ATTRIBUTE, edge);
  guard.tabIndex = 0;
  guard.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;outline:none';
  return guard;
}

function focusableIn(dialog: HTMLElement | null): HTMLElement[] {
  return [...(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])];
}

/** Whether focus moving to `target` crossed the dialog's start edge (Shift+Tab) rather than its end. */
function leftThroughStart(dialog: HTMLElement, target: Element): boolean {
  if (target.getAttribute(GUARD_ATTRIBUTE) === 'start') return true;
  if (target.hasAttribute(GUARD_ATTRIBUTE)) return false;
  return Boolean(dialog.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING);
}

/**
 * Keyboard behavior of a modal dialog: focus moves into the dialog when it opens, Tab and
 * Shift+Tab cycle inside it (also out of an embedded document), Escape closes it, and focus
 * returns to where it came from. With stacked dialogs only the topmost one reacts.
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

    const token = {};
    openDialogs.push(token);
    const isTopmost = () => openDialogs.at(-1) === token;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnTarget = returnFocusRef?.current ?? previouslyFocused;
    const dialog = dialogRef.current;
    const startGuard = createFocusGuard('start');
    const endGuard = createFocusGuard('end');
    dialog?.before(startGuard);
    dialog?.after(endGuard);
    initialFocusRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = focusableIn(dialogRef.current);
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

    const handleFocusIn = (event: FocusEvent) => {
      const current = dialogRef.current;
      const target = event.target;
      if (!isTopmost() || !current || !(target instanceof Element) || current.contains(target)) return;

      const focusable = focusableIn(current);
      const destination = leftThroughStart(current, target) ? focusable.at(-1) : focusable[0];
      (destination ?? initialFocusRef.current)?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      startGuard.remove();
      endGuard.remove();
      openDialogs.splice(openDialogs.indexOf(token), 1);
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [dialogRef, initialFocusRef, isOpen, returnFocusRef]);
}

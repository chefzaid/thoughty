import { useEffect, type RefObject } from 'react';
import { isFocusModeShortcut, openFocusModeFrom } from '../FocusMode/focusModeShortcut';

/** Whether keys typed at `target` go into text (a field or editable content). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || target.isContentEditable;
}

function focusFirstField(container: HTMLElement | null): void {
  const field = container?.querySelector<HTMLElement>('textarea, input, [contenteditable="true"]');
  field?.focus();

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.select();
  }
}

interface UseJournalKeyboardShortcutsParams {
  entryFormRef: RefObject<HTMLElement | null>;
  searchRef: RefObject<HTMLElement | null>;
  closeHighlights: () => void;
  highlightsOpen: boolean;
}

export function useJournalKeyboardShortcuts({
  entryFormRef,
  searchRef,
  closeHighlights,
  highlightsOpen,
}: UseJournalKeyboardShortcutsParams): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (isCtrlOrMeta && key === 'n') {
        event.preventDefault();
        focusFirstField(entryFormRef.current);
        return;
      }

      // Focus mode for the entry being edited when the focus is in its editor, otherwise for the composer
      if (isFocusModeShortcut(event) && !event.defaultPrevented) {
        if (openFocusModeFrom(document.activeElement, entryFormRef.current)) {
          event.preventDefault();
        }
        return;
      }

      if (isCtrlOrMeta && event.key === '/') {
        event.preventDefault();
        focusFirstField(searchRef.current);
        return;
      }

      if (event.key === 'Escape' && highlightsOpen) {
        closeHighlights();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeHighlights, entryFormRef, highlightsOpen, searchRef]);
}

import { useEffect, type RefObject } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
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
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  closeHighlights: () => void;
  highlightsOpen: boolean;
}

export function useJournalKeyboardShortcuts({
  entryFormRef,
  searchRef,
  page,
  totalPages,
  setPage,
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

      if (isCtrlOrMeta && event.key === '/') {
        event.preventDefault();
        focusFirstField(searchRef.current);
        return;
      }

      if (event.key === 'Escape' && highlightsOpen) {
        closeHighlights();
        return;
      }

      if (isEditableTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (event.key === 'ArrowLeft' && page > 1) {
        event.preventDefault();
        setPage(Math.max(1, page - 1));
        return;
      }

      if (event.key === 'ArrowRight' && page < totalPages) {
        event.preventDefault();
        setPage(Math.min(totalPages, page + 1));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeHighlights, entryFormRef, highlightsOpen, page, searchRef, setPage, totalPages]);
}

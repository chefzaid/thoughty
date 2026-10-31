import { useState, useCallback } from 'react';
import type { Entry } from '../types';
import type { RephraseMode } from '../services/api/aiService';
import { pluralPhrase } from '../utils/pluralPhrase';
import { useApiServices } from './useApiServices';
import type { Notifier } from './useAppNotice';

type BulkAction = 'delete' | 'visibility' | 'tags' | 'move' | 'archive' | 'rephrase' | 'book';
type BulkOptions = { visibility?: 'public' | 'private'; tags?: string[]; diaryId?: number; isArchived?: boolean; mode?: RephraseMode };

type BulkRephraseOutcome = 'updated' | 'unchanged' | 'failed';

const normalizeStoredEntryDate = (entryDate: string): string => (
  entryDate.includes('T') ? (entryDate.split('T')[0] ?? entryDate) : entryDate
);

const rephraseSelectedEntry = async (
  entry: Entry,
  mode: RephraseMode,
  aiFixWriting: (content: string, mode?: RephraseMode) => Promise<string | null>,
  updateEntry: (id: number, data: { text: string; tags: string[]; date: string; visibility: 'public' | 'private'; format: 'plain' | 'markdown' }) => Promise<boolean>,
): Promise<BulkRephraseOutcome> => {
  if (!entry.content.trim()) {
    return 'failed';
  }

  const rewritten = await aiFixWriting(entry.content, mode);
  if (rewritten === null) {
    return 'failed';
  }

  if (rewritten === entry.content) {
    return 'unchanged';
  }

  const success = await updateEntry(entry.id, {
    text: rewritten,
    tags: entry.tags,
    date: normalizeStoredEntryDate(entry.date),
    visibility: entry.visibility,
    format: entry.format ?? 'plain',
  });

  return success ? 'updated' : 'failed';
};

/**
 * The entries oldest day first and in their order within the day, so restoring them one after the other puts
 * each back in its place. Entries the list no longer shows keep their place at the end.
 */
const inDayOrder = (ids: number[], entries: Entry[]): number[] => {
  const listed = new Map(entries.map((entry) => [entry.id, entry]));
  const place = (id: number): [string, number] | null => {
    const entry = listed.get(id);
    return entry ? [normalizeStoredEntryDate(entry.date), entry.index ?? 0] : null;
  };
  return [...ids].sort((left, right) => {
    const [a, b] = [place(left), place(right)];
    if (!a || !b) return Number(!a) - Number(!b);
    return a[0] === b[0] ? a[1] - b[1] : a[0].localeCompare(b[0]);
  });
};

/**
 * The journal's bulk selection and its actions. `onMakeBook` receives the selected entries for the book
 * converter (Make a book); without it that action does nothing. `onDeleted` hears which entries went to the
 * recycle bin, oldest day first and in their order within the day.
 */
export const useBulkSelect = (
  onComplete: () => void,
  entries: Entry[],
  { notify, t, language }: Notifier,
  onMakeBook?: (entryIds: number[]) => void,
  onDeleted?: (entryIds: number[]) => void,
) => {
  const { entriesService, aiService } = useApiServices();

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: BulkAction; options?: BulkOptions } | null>(null);

  const toggleBulkMode = useCallback(() => {
    setBulkMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const executeBulkRephrase = useCallback(async (mode: RephraseMode | undefined) => {
    const ids = Array.from(selectedIds);
    const selectedEntries = ids
      .map((id) => entries.find((entry) => entry.id === id))
      .filter((entry): entry is Entry => Boolean(entry));

    if (selectedEntries.length === 0) {
      notify(t('bulkRephraseNoEntries'));
      return;
    }

    let updatedCount = 0;
    let unchangedCount = 0;
    let failedCount = 0;

    for (const entry of selectedEntries) {
      const outcome = await rephraseSelectedEntry(
        entry,
        mode ?? 'grammar',
        aiService.fixWriting,
        entriesService.updateEntry,
      );

      if (outcome === 'updated') {
        updatedCount += 1;
      } else if (outcome === 'unchanged') {
        unchangedCount += 1;
      } else {
        failedCount += 1;
      }
    }

    if (updatedCount > 0) {
      setSelectedIds(new Set());
      setBulkMode(false);
      onComplete();

      if (failedCount > 0 || unchangedCount > 0) {
        notify(t('bulkRephraseSummary', {
          updated: pluralPhrase(t, 'bulkRephraseUpdated', updatedCount, language),
          unchanged: pluralPhrase(t, 'bulkRephraseUnchanged', unchangedCount, language),
          failed: pluralPhrase(t, 'bulkRephraseFailedCount', failedCount, language),
        }));
      }
      return;
    }

    if (unchangedCount > 0 && failedCount === 0) {
      notify(t('bulkRephraseNothingToChange'));
      return;
    }

    notify(t('bulkRephraseError'));
  }, [aiService, entries, entriesService, language, notify, onComplete, selectedIds, t]);

  const executeBulkAction = useCallback(async (action: Exclude<BulkAction, 'book'>, options?: BulkOptions) => {
    if (action === 'rephrase') {
      await executeBulkRephrase(options?.mode);
      return;
    }

    const ids = Array.from(selectedIds);
    const result = await entriesService.bulkOperation(ids, action, options);
    if (result?.success) {
      setSelectedIds(new Set());
      setBulkMode(false);
      onComplete();
      if (action === 'delete') {
        onDeleted?.(inDayOrder(ids, entries));
      }
    } else {
      notify(t('bulkOperationFailed'));
    }
  }, [entries, entriesService, executeBulkRephrase, notify, onComplete, onDeleted, selectedIds, t]);

  const requestBulkAction = useCallback((action: BulkAction, options?: BulkOptions) => {
    if (selectedIds.size === 0) {
      return;
    }
    if (action === 'delete') {
      setPendingAction({ action });
      setBulkModalOpen(true);
      return;
    }
    if (action === 'book') {
      const ids = Array.from(selectedIds);
      setSelectedIds(new Set());
      setBulkMode(false);
      onMakeBook?.(ids);
      return;
    }
    executeBulkAction(action, options);
  }, [executeBulkAction, onMakeBook, selectedIds]);

  const confirmBulkDelete = useCallback(async () => {
    setBulkModalOpen(false);
    await executeBulkAction('delete');
    setPendingAction(null);
  }, [executeBulkAction]);

  const cancelBulkModal = useCallback(() => {
    setBulkModalOpen(false);
    setPendingAction(null);
  }, []);

  return {
    bulkMode,
    selectedIds,
    bulkModalOpen,
    pendingAction,
    toggleBulkMode,
    toggleSelect,
    selectAll,
    clearSelection,
    requestBulkAction,
    executeBulkAction,
    confirmBulkDelete,
    cancelBulkModal,
  };
};

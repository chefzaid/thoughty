import { useState, useCallback } from 'react';
import type { Entry } from '../types';
import type { RephraseMode } from '../services/api/aiService';
import { useApiServices } from './useApiServices';

type BulkAction = 'delete' | 'visibility' | 'tags' | 'move' | 'archive' | 'rephrase';
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

export const useBulkSelect = (onComplete: () => void, entries: Entry[] = []) => {
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
      alert('No selected entries are available to rephrase.');
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
        alert(`Bulk rephrase completed: ${updatedCount} updated, ${unchangedCount} unchanged, ${failedCount} failed.`);
      }
      return;
    }

    if (unchangedCount > 0 && failedCount === 0) {
      alert('No selected entries needed rephrasing.');
      return;
    }

    alert('Bulk rephrase failed.');
  }, [aiService, entries, entriesService, onComplete, selectedIds]);

  const executeBulkAction = useCallback(async (action: BulkAction, options?: BulkOptions) => {
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
    } else {
      alert('Bulk operation failed.');
    }
  }, [entriesService, executeBulkRephrase, onComplete, selectedIds]);

  const requestBulkAction = useCallback((action: BulkAction, options?: BulkOptions) => {
    if (selectedIds.size === 0) {
      return;
    }
    if (action === 'delete') {
      setPendingAction({ action });
      setBulkModalOpen(true);
      return;
    }
    executeBulkAction(action, options);
  }, [executeBulkAction, selectedIds]);

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

import { useState, useCallback } from 'react';
import { useApiServices } from './useApiServices';
import type { Notifier } from './useAppNotice';

/** The delete confirmation for one entry; `onDelete` hears which entry went to the recycle bin. */
export const useDeleteModal = (onDelete: (entryId: number) => void, { notify, t }: Notifier) => {
  const { entriesService } = useApiServices();

  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);

  const handleDelete = useCallback((entryId: number) => {
    setEntryToDelete(entryId);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!entryToDelete) {
      return;
    }

    const success = await entriesService.deleteEntry(entryToDelete);
    if (success) {
      onDelete(entryToDelete);
    } else {
      notify(t('entryDeleteFailed'));
    }

    setDeleteModalOpen(false);
    setEntryToDelete(null);
  }, [entriesService, entryToDelete, notify, onDelete, t]);

  const cancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setEntryToDelete(null);
  }, []);

  return {
    deleteModalOpen,
    entryToDelete,
    handleDelete,
    confirmDelete,
    cancelDelete,
  };
};

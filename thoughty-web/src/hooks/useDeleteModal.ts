import { useState, useCallback } from 'react';
import { useApiServices } from './useApiServices';

export const useDeleteModal = (onDelete: () => void) => {
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
      onDelete();
    } else {
      alert('Failed to delete entry.');
    }

    setDeleteModalOpen(false);
    setEntryToDelete(null);
  }, [entriesService, entryToDelete, onDelete]);

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

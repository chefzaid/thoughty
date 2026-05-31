import { useState, useEffect, useCallback } from 'react';
import type { Attachment, Config, Entry } from '../types';
import type { RephraseMode } from '../services/api/aiService';
import { useApiServices } from './useApiServices';

const getAutoTagLimit = (value: string | number | undefined): number => {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(parsed, 10);
};

const formatEntryDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

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

export const useEntryForm = (
  config: Config,
  currentDiaryId: number | null,
  onSuccess: () => void,
) => {
  const { entriesService, attachmentsService, aiService } = useApiServices();

  const [newEntryText, setNewEntryText] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visibility, setVisibility] = useState<'public' | 'private' | null>(null);
  const [format, setFormat] = useState<'plain' | 'markdown'>('plain');
  const [formError, setFormError] = useState<string>('');
  const [suggestingTags, setSuggestingTags] = useState<boolean>(false);
  const [fixingWriting, setFixingWriting] = useState<boolean>(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
  const autoTagLimit = getAutoTagLimit(config.autoTagMaxTags);

  const resetEntryForm = useCallback(() => {
    setNewEntryText('');
    setTags([]);
    setFormat('plain');
    setVisibility(config.defaultVisibility || 'private');
    setPendingFiles([]);
    setUploadedAttachments([]);
  }, [config.defaultVisibility]);

  const validateEntryForm = useCallback(() => {
    if (!newEntryText.trim()) {
      return 'Please enter some text';
    }
    if ((!tags || tags.length === 0) && autoTagLimit === 0) {
      return 'Please add at least one tag';
    }
    return '';
  }, [newEntryText, tags, autoTagLimit]);

  useEffect(() => {
    if (config.defaultVisibility && visibility === null) {
      setVisibility(config.defaultVisibility);
    }
  }, [config.defaultVisibility, visibility]);

  const handleSubmit = useCallback(async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setFormError('');

    const validationError = validateEntryForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const result = await entriesService.createEntry({
      text: newEntryText,
      tags,
      date: formatEntryDate(selectedDate),
      visibility,
      format,
      diaryId: currentDiaryId,
    });

    if (!result.success || !result.entryId) {
      setFormError('Failed to save entry. Please try again.');
      return;
    }

    const allAttachmentIds = uploadedAttachments.map((attachment) => attachment.id);
    for (const file of pendingFiles) {
      const uploaded = await attachmentsService.uploadAttachment(file, result.entryId);
      if (uploaded) {
        allAttachmentIds.push(uploaded.id);
      }
    }

    for (const attachment of uploadedAttachments) {
      if (!attachment.entry_id) {
        await attachmentsService.linkAttachment(attachment.id, result.entryId);
      }
    }

    resetEntryForm();
    onSuccess();
  }, [attachmentsService, currentDiaryId, entriesService, format, newEntryText, onSuccess, pendingFiles, resetEntryForm, selectedDate, tags, uploadedAttachments, validateEntryForm, visibility]);

  const addPendingFile = useCallback((file: File) => {
    setPendingFiles((prev) => [...prev, file]);
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const removeUploadedAttachment = useCallback(async (attachmentId: number) => {
    await attachmentsService.deleteAttachment(attachmentId);
    setUploadedAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  }, [attachmentsService]);

  const handleSuggestTags = useCallback(async () => {
    if (!newEntryText.trim()) {
      setFormError('Write a thought before asking for tag suggestions');
      return false;
    }

    setFormError('');
    setSuggestingTags(true);
    const suggestedTags = await aiService.suggestTags(newEntryText, tags, autoTagLimit || 5);
    setSuggestingTags(false);

    if (suggestedTags === null) {
      setFormError('Unable to suggest tags. Check your OpenRouter API key and try again.');
      return false;
    }
    if (suggestedTags.length === 0) {
      setFormError('No tag suggestions were returned. Try adding more detail.');
      return false;
    }

    setTags((prev) => [...new Set([...prev, ...suggestedTags])]);
    return true;
  }, [aiService, autoTagLimit, newEntryText, tags]);

  const handleFixWriting = useCallback(async () => {
    if (!newEntryText.trim()) {
      setFormError('Write a thought before asking for writing fixes');
      return false;
    }

    setFormError('');
    setFixingWriting(true);
    const corrected = await aiService.fixWriting(newEntryText);
    setFixingWriting(false);

    if (corrected === null) {
      setFormError('Unable to fix writing. Check your OpenRouter API key and try again.');
      return false;
    }
    if (corrected === newEntryText) {
      setFormError('No corrections were needed.');
      return false;
    }

    setNewEntryText(corrected);
    return true;
  }, [aiService, newEntryText]);

  return {
    newEntryText,
    setNewEntryText,
    tags,
    setTags,
    selectedDate,
    setSelectedDate,
    visibility,
    setVisibility,
    format,
    setFormat,
    formError,
    setFormError,
    suggestingTags,
    handleSuggestTags,
    fixingWriting,
    handleFixWriting,
    handleSubmit,
    pendingFiles,
    uploadedAttachments,
    addPendingFile,
    removePendingFile,
    removeUploadedAttachment,
  };
};

export const useEntryEdit = (config: Config, onSave: () => void) => {
  const { entriesService, attachmentsService } = useApiServices();
  const autoTagLimit = getAutoTagLimit(config.autoTagMaxTags);

  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('private');
  const [editFormat, setEditFormat] = useState<'plain' | 'markdown'>('plain');
  const [editPendingFiles, setEditPendingFiles] = useState<File[]>([]);
  const [editExistingAttachments, setEditExistingAttachments] = useState<Attachment[]>([]);

  const handleEdit = useCallback((entry: Entry) => {
    setEditingEntry(entry);
    setEditText(entry.content);
    setEditTags(entry.tags || []);
    setEditVisibility(entry.visibility || 'private');
    setEditFormat(entry.format || 'plain');
    setEditPendingFiles([]);
    setEditExistingAttachments(entry.attachments || []);
    let dateStr = entry.date;
    if (dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0] ?? dateStr;
    }
    const [year = new Date().getFullYear(), month = 1, day = 1] = dateStr.split('-').map(Number);
    setEditDate(new Date(year, month - 1, day));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
    setEditText('');
    setEditTags([]);
    setEditDate(null);
    setEditVisibility('private');
    setEditFormat('plain');
    setEditPendingFiles([]);
    setEditExistingAttachments([]);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editText.trim() || (editTags.length === 0 && autoTagLimit === 0)) {
      alert('Text and at least one tag are required');
      return;
    }
    if (!editDate || !editingEntry) {
      return;
    }

    const success = await entriesService.updateEntry(editingEntry.id, {
      text: editText,
      tags: editTags,
      date: formatEntryDate(editDate),
      visibility: editVisibility,
      format: editFormat,
    });

    if (!success) {
      alert('Failed to update entry.');
      return;
    }

    for (const file of editPendingFiles) {
      await attachmentsService.uploadAttachment(file, editingEntry.id);
    }

    const originalIds = new Set((editingEntry.attachments || []).map((attachment) => attachment.id));
    const remainingIds = new Set(editExistingAttachments.map((attachment) => attachment.id));
    for (const attachmentId of originalIds) {
      if (!remainingIds.has(attachmentId)) {
        await attachmentsService.deleteAttachment(attachmentId);
      }
    }

    handleCancelEdit();
    onSave();
  }, [attachmentsService, autoTagLimit, editDate, editExistingAttachments, editFormat, editPendingFiles, editTags, editText, editVisibility, editingEntry, entriesService, handleCancelEdit, onSave]);

  const addEditPendingFile = useCallback((file: File) => {
    setEditPendingFiles((prev) => [...prev, file]);
  }, []);

  const removeEditPendingFile = useCallback((index: number) => {
    setEditPendingFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const removeEditAttachment = useCallback(async (attachmentId: number) => {
    setEditExistingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  return {
    editingEntry,
    editText,
    setEditText,
    editTags,
    setEditTags,
    editDate,
    setEditDate,
    editVisibility,
    setEditVisibility,
    editFormat,
    setEditFormat,
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    editPendingFiles,
    editExistingAttachments,
    addEditPendingFile,
    removeEditPendingFile,
    removeEditAttachment,
  };
};

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
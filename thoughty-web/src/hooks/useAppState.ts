import { useState, useEffect, useCallback, useMemo, useOptimistic, useTransition } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createAuthFetch, createConfigService, createEntriesService, createDiariesService, createAttachmentsService, createAiService, createCloudSyncService } from '../services/api';
import type { Config, Entry, Diary, ProfileStats, GroupedEntries, SourceEntryInfo, Attachment } from '../types';
import { getTranslation, TranslationKey } from '../utils/translations';

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

/**
 * Hook to create authenticated API services
 */
export const useApiServices = () => {
  const { authFetch, getAccessToken } = useAuth();
  
  const authFetchHelper = useMemo(() => {
    return createAuthFetch(authFetch, getAccessToken);
  }, [authFetch, getAccessToken]);

  const configService = useMemo(() => createConfigService(authFetchHelper), [authFetchHelper]);
  const entriesService = useMemo(() => createEntriesService(authFetchHelper), [authFetchHelper]);
  const diariesService = useMemo(() => createDiariesService(authFetchHelper), [authFetchHelper]);
  const attachmentsService = useMemo(() => createAttachmentsService(authFetchHelper), [authFetchHelper]);
  const aiService = useMemo(() => createAiService(authFetchHelper), [authFetchHelper]);
  const cloudSyncService = useMemo(() => createCloudSyncService(authFetchHelper), [authFetchHelper]);

  return { authFetchHelper, configService, entriesService, diariesService, attachmentsService, aiService, cloudSyncService };
};

/**
 * Hook to manage app configuration
 */
export const useConfig = (isAuthenticated: boolean) => {
  const { configService } = useApiServices();
  const [config, setConfig] = useState<Config>({});
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);

  const fetchConfig = useCallback(async () => {
    const data = await configService.fetchConfig();
    if (data) setConfig(data);
  }, [configService]);

  const fetchProfileStats = useCallback(async () => {
    const stats = await configService.fetchProfileStats();
    if (stats) setProfileStats(stats);
  }, [configService]);

  const updateConfig = useCallback(async (newConfig: Config) => {
    await configService.updateConfig(newConfig);
    setConfig(newConfig);
  }, [configService]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchConfig();
      fetchProfileStats();
    }
  }, [isAuthenticated, fetchConfig, fetchProfileStats]);

  // Apply theme
  useEffect(() => {
    if (config.theme === 'light') {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    } else {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    }
  }, [config.theme]);

  // Translation function
  const t = useCallback((key: string, params: Record<string, string | number> = {}): string => {
    return getTranslation(config.language || 'en', key as TranslationKey, params);
  }, [config.language]);

  const downloadUserData = useCallback(async () => {
    return configService.downloadUserData();
  }, [configService]);

  return {
    config,
    setConfig,
    profileStats,
    fetchConfig,
    fetchProfileStats,
    updateConfig,
    downloadUserData,
    t
  };
};

/**
 * Hook to manage diaries
 */
export const useDiaries = (isAuthenticated: boolean) => {
  const { diariesService } = useApiServices();
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [currentDiaryId, setCurrentDiaryId] = useState<number | null>(null);

  const fetchDiaries = useCallback(async () => {
    const data = await diariesService.fetchDiaries();
    setDiaries(data);
    if (!currentDiaryId && data.length > 0) {
      const defaultDiary = data.find(d => d.is_default);
      if (defaultDiary) setCurrentDiaryId(defaultDiary.id);
    }
  }, [diariesService, currentDiaryId]);

  const handleCreateDiary = useCallback(async (diaryData: Partial<Diary>) => {
    const result = await diariesService.createDiary(diaryData);
    if (!result.success) throw new Error(result.error);
    await fetchDiaries();
  }, [diariesService, fetchDiaries]);

  const handleUpdateDiary = useCallback(async (id: number, diaryData: Partial<Diary>) => {
    const result = await diariesService.updateDiary(id, diaryData);
    if (!result.success) throw new Error(result.error);
    await fetchDiaries();
  }, [diariesService, fetchDiaries]);

  const handleDeleteDiary = useCallback(async (id: number, refreshEntries: () => void) => {
    const result = await diariesService.deleteDiary(id);
    if (!result.success) throw new Error(result.error);
    if (currentDiaryId === id) {
      const defaultDiary = diaries.find(d => d.is_default);
      setCurrentDiaryId(defaultDiary?.id || null);
    }
    await fetchDiaries();
    refreshEntries();
  }, [diariesService, currentDiaryId, diaries, fetchDiaries]);

  const handleSetDefaultDiary = useCallback(async (id: number) => {
    const result = await diariesService.setDefaultDiary(id);
    if (!result.success) throw new Error(result.error);
    await fetchDiaries();
  }, [diariesService, fetchDiaries]);

  const handleReorderDiaries = useCallback(async (orderedIds: number[]) => {
    const result = await diariesService.reorderDiaries(orderedIds);
    if (!result.success) throw new Error(result.error);
    await fetchDiaries();
  }, [diariesService, fetchDiaries]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDiaries();
    }
  }, [isAuthenticated]);

  return {
    diaries,
    currentDiaryId,
    setCurrentDiaryId,
    fetchDiaries,
    handleCreateDiary,
    handleUpdateDiary,
    handleDeleteDiary,
    handleSetDefaultDiary,
    handleReorderDiaries
  };
};

/**
 * Hook to manage entries
 */
export const useEntries = (
  isAuthenticated: boolean,
  config: Config,
  currentDiaryId: number | null
) => {
  const { entriesService } = useApiServices();
  
  // Entries state
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [entryDates, setEntryDates] = useState<string[]>([]);
  
  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');
  
  // Filter state
  const [search, setSearch] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDateObj, setFilterDateObj] = useState<Date | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [filterFavorites, setFilterFavorites] = useState<boolean>(false);
  
  // Navigation state
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [targetEntryId, setTargetEntryId] = useState<number | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<number | null>(null);
  const [sourceEntry, setSourceEntry] = useState<SourceEntryInfo | null>(null);

  const getLimit = useCallback(() => {
    return typeof config.entriesPerPage === 'number' 
      ? config.entriesPerPage 
      : Number.parseInt(config.entriesPerPage || '10', 10) || 10;
  }, [config.entriesPerPage]);

  const fetchEntryDates = useCallback(async () => {
    const dates = await entriesService.fetchEntryDates();
    setEntryDates(dates);
  }, [entriesService]);

  const fetchEntries = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    
    const filterDate = filterDateObj
      ? `${filterDateObj.getFullYear()}-${String(filterDateObj.getMonth() + 1).padStart(2, '0')}-${String(filterDateObj.getDate()).padStart(2, '0')}`
      : '';
    
    const result = await entriesService.fetchEntries({
      page,
      limit: getLimit(),
      search,
      filterTags,
      filterDate,
      filterVisibility: filterVisibility === 'all' ? '' : filterVisibility,
      favorites: filterFavorites,
      diaryId: currentDiaryId
    });
    
    if (result) {
      setEntries(result.entries);
      setTotalPages(result.totalPages);
      setAllTags(result.allTags);
    }
    setLoading(false);
  }, [isAuthenticated, entriesService, page, search, filterTags, filterDateObj, filterVisibility, filterFavorites, currentDiaryId, getLimit]);

  const fetchYearsMonths = useCallback(async () => {
    if (!isAuthenticated) return;
    const data = await entriesService.fetchYearsMonths();
    setAvailableYears(data.years);
    setAvailableMonths(data.months);
  }, [isAuthenticated, entriesService]);

  // Optimistic visibility toggle (React 19)
  const [optimisticEntries, addOptimistic] = useOptimistic(
    entries,
    (state, update: { id: number; visibility: 'public' | 'private' }) =>
      state.map(e => e.id === update.id ? { ...e, visibility: update.visibility } : e)
  );

  const [, startVisibilityTransition] = useTransition();

  const toggleVisibility = useCallback((entry: Entry) => {
    const newVisibility = entry.visibility === 'public' ? 'private' : 'public';
    startVisibilityTransition(async () => {
      addOptimistic({ id: entry.id, visibility: newVisibility });
      const success = await entriesService.toggleVisibility(entry.id, newVisibility);
      if (success) {
        await fetchEntries();
      }
    });
  }, [entriesService, fetchEntries, addOptimistic, startVisibilityTransition]);

  const toggleFavorite = useCallback(async (entry: Entry) => {
    const newFavorite = !entry.is_favorite;
    const success = await entriesService.toggleFavorite(entry.id, newFavorite);
    if (success) {
      await fetchEntries();
    }
  }, [entriesService, fetchEntries]);

  const fetchEntryHistory = useCallback(async (entryId: number) => {
    return entriesService.fetchEntryHistory(entryId);
  }, [entriesService]);

  // Group entries by date
  const groupedEntries: GroupedEntries = useMemo(() => {
    const grouped = optimisticEntries.reduce((acc: GroupedEntries, entry) => {
      let dateStr = entry.date;
      if (dateStr.includes('T')) dateStr = dateStr.split('T')[0] ?? dateStr;
      acc[dateStr] ??= [];
      acc[dateStr]?.push(entry);
      return acc;
    }, {});

    Object.keys(grouped).forEach(date => {
      grouped[date]?.sort((a, b) => (a.index || 0) - (b.index || 0));
    });

    return grouped;
  }, [optimisticEntries]);

  // Sync inputPage with page
  useEffect(() => { 
    setInputPage(page.toString()); 
  }, [page]);

  // Fetch entries on dependency change
  useEffect(() => {
    fetchEntries();
  }, [page, search, filterTags, filterDateObj, filterVisibility, filterFavorites, config.entriesPerPage, currentDiaryId, isAuthenticated]);

  // Fetch years/months on mount
  useEffect(() => {
    fetchYearsMonths();
  }, [isAuthenticated]);

  // Scroll to target entry
  useEffect(() => {
    if (targetEntryId && !loading && entries.length > 0) {
      const entryElement = document.getElementById(`entry-${targetEntryId}`);
      if (entryElement) {
        entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        entryElement.classList.add('highlight-entry');
        setTimeout(() => {
          entryElement.classList.remove('highlight-entry');
        }, 2000);
        setTargetEntryId(null);
      }
    }
  }, [targetEntryId, loading, entries]);

  return {
    // Data
    entries,
    setEntries,
    groupedEntries,
    loading,
    allTags,
    entryDates,
    // Pagination
    page,
    setPage,
    totalPages,
    inputPage,
    setInputPage,
    // Filters
    search,
    setSearch,
    filterTags,
    setFilterTags,
    filterDateObj,
    setFilterDateObj,
    filterVisibility,
    setFilterVisibility,
    filterFavorites,
    setFilterFavorites,
    // Navigation
    availableYears,
    availableMonths,
    targetEntryId,
    setTargetEntryId,
    activeTargetId,
    setActiveTargetId,
    sourceEntry,
    setSourceEntry,
    // Actions
    fetchEntries,
    fetchEntryDates,
    getLimit,
    entriesService,
    toggleVisibility,
    toggleFavorite,
    fetchEntryHistory
  };
};

/**
 * Hook to manage entry form
 */
export const useEntryForm = (
  config: Config,
  currentDiaryId: number | null,
  onSuccess: () => void
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

  // Set default visibility from config
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

    const dateStr = formatEntryDate(selectedDate);

    const result = await entriesService.createEntry({
      text: newEntryText,
      tags,
      date: dateStr,
      visibility,
      format,
      diaryId: currentDiaryId
    });

    if (result.success && result.entryId) {
      // Upload pending files and link uploaded attachments to the new entry
      const allAttachmentIds = uploadedAttachments.map(a => a.id);
      
      for (const file of pendingFiles) {
        const uploaded = await attachmentsService.uploadAttachment(file, result.entryId);
        if (uploaded) {
          allAttachmentIds.push(uploaded.id);
        }
      }

      // Link any pre-uploaded attachments
      for (const att of uploadedAttachments) {
        if (!att.entry_id) {
          await attachmentsService.linkAttachment(att.id, result.entryId);
        }
      }

      resetEntryForm();
      onSuccess();
    } else {
      setFormError('Failed to save entry. Please try again.');
    }
  }, [newEntryText, tags, selectedDate, visibility, format, currentDiaryId, entriesService, attachmentsService, pendingFiles, uploadedAttachments, validateEntryForm, resetEntryForm, onSuccess]);

  const addPendingFile = useCallback((file: File) => {
    setPendingFiles(prev => [...prev, file]);
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeUploadedAttachment = useCallback(async (attachmentId: number) => {
    await attachmentsService.deleteAttachment(attachmentId);
    setUploadedAttachments(prev => prev.filter(a => a.id !== attachmentId));
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
  }, [aiService, newEntryText, tags]);

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
    removeUploadedAttachment
  };
};

/**
 * Hook to manage entry editing
 */
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
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0] ?? dateStr;
    const parts = dateStr.split('-').map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
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
    if (!editDate || !editingEntry) return;

    const dateStr = `${editDate.getFullYear()}-${String(editDate.getMonth() + 1).padStart(2, '0')}-${String(editDate.getDate()).padStart(2, '0')}`;
    
    const success = await entriesService.updateEntry(editingEntry.id, {
      text: editText,
      tags: editTags,
      date: dateStr,
      visibility: editVisibility,
      format: editFormat
    });

    if (success) {
      // Upload pending files and link to entry
      for (const file of editPendingFiles) {
        await attachmentsService.uploadAttachment(file, editingEntry.id);
      }

      // Delete removed attachments
      const originalIds = new Set((editingEntry.attachments || []).map(a => a.id));
      const remainingIds = new Set(editExistingAttachments.map(a => a.id));
      for (const id of originalIds) {
        if (!remainingIds.has(id)) {
          await attachmentsService.deleteAttachment(id);
        }
      }

      handleCancelEdit();
      onSave();
    } else {
      alert('Failed to update entry.');
    }
  }, [editText, editTags, editDate, editVisibility, editFormat, editingEntry, autoTagLimit, entriesService, attachmentsService, editPendingFiles, editExistingAttachments, handleCancelEdit, onSave]);

  const addEditPendingFile = useCallback((file: File) => {
    setEditPendingFiles(prev => [...prev, file]);
  }, []);

  const removeEditPendingFile = useCallback((index: number) => {
    setEditPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeEditAttachment = useCallback(async (attachmentId: number) => {
    setEditExistingAttachments(prev => prev.filter(a => a.id !== attachmentId));
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
    removeEditAttachment
  };
};

/**
 * Hook to manage delete confirmation modal
 */
export const useDeleteModal = (onDelete: () => void) => {
  const { entriesService } = useApiServices();
  
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);

  const handleDelete = useCallback((entryId: number) => {
    setEntryToDelete(entryId);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!entryToDelete) return;
    
    const success = await entriesService.deleteEntry(entryToDelete);
    if (success) {
      onDelete();
    } else {
      alert('Failed to delete entry.');
    }
    
    setDeleteModalOpen(false);
    setEntryToDelete(null);
  }, [entryToDelete, entriesService, onDelete]);

  const cancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setEntryToDelete(null);
  }, []);

  return {
    deleteModalOpen,
    entryToDelete,
    handleDelete,
    confirmDelete,
    cancelDelete
  };
};

/**
 * Hook to manage bulk selection and operations on entries
 */
type BulkAction = 'delete' | 'visibility' | 'tags' | 'move';
type BulkOptions = { visibility?: 'public' | 'private'; tags?: string[]; diaryId?: number };

export const useBulkSelect = (onComplete: () => void) => {
  const { entriesService } = useApiServices();

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: BulkAction;
    options?: BulkOptions;
  } | null>(null);

  const toggleBulkMode = useCallback(() => {
    setBulkMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const executeBulkAction = useCallback(
    async (action: BulkAction, options?: BulkOptions) => {
      const ids = Array.from(selectedIds);
      const result = await entriesService.bulkOperation(ids, action, options);
      if (result?.success) {
        setSelectedIds(new Set());
        setBulkMode(false);
        onComplete();
      } else {
        alert('Bulk operation failed.');
      }
    },
    [selectedIds, entriesService, onComplete],
  );

  const requestBulkAction = useCallback(
    (action: BulkAction, options?: BulkOptions) => {
      if (selectedIds.size === 0) return;
      if (action === 'delete') {
        setPendingAction({ action });
        setBulkModalOpen(true);
      } else {
        executeBulkAction(action, options);
      }
    },
    [selectedIds, executeBulkAction],
  );

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

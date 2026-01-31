import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createAuthFetch, createConfigService, createEntriesService, createDiariesService } from '../services/api';
import type { Config, Entry, Diary, ProfileStats, GroupedEntries, SourceEntryInfo } from '../types';
import { getTranslation, TranslationKey } from '../utils/translations';

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

  return { authFetchHelper, configService, entriesService, diariesService };
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

  return {
    config,
    setConfig,
    profileStats,
    fetchConfig,
    fetchProfileStats,
    updateConfig,
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
    handleSetDefaultDiary
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
      diaryId: currentDiaryId
    });
    
    if (result) {
      setEntries(result.entries);
      setTotalPages(result.totalPages);
      setAllTags(result.allTags);
    }
    setLoading(false);
  }, [isAuthenticated, entriesService, page, search, filterTags, filterDateObj, filterVisibility, currentDiaryId, getLimit]);

  const fetchYearsMonths = useCallback(async () => {
    if (!isAuthenticated) return;
    const data = await entriesService.fetchYearsMonths();
    setAvailableYears(data.years);
    setAvailableMonths(data.months);
  }, [isAuthenticated, entriesService]);

  // Group entries by date
  const groupedEntries: GroupedEntries = useMemo(() => {
    const grouped = entries.reduce((acc: GroupedEntries, entry) => {
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
  }, [entries]);

  // Sync inputPage with page
  useEffect(() => { 
    setInputPage(page.toString()); 
  }, [page]);

  // Fetch entries on dependency change
  useEffect(() => {
    fetchEntries();
  }, [page, search, filterTags, filterDateObj, filterVisibility, config.entriesPerPage, currentDiaryId, isAuthenticated]);

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
    entriesService
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
  const { entriesService } = useApiServices();
  
  const [newEntryText, setNewEntryText] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visibility, setVisibility] = useState<'public' | 'private' | null>(null);
  const [formError, setFormError] = useState<string>('');

  // Set default visibility from config
  useEffect(() => {
    if (config.defaultVisibility && visibility === null) {
      setVisibility(config.defaultVisibility);
    }
  }, [config.defaultVisibility, visibility]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');

    if (!newEntryText.trim()) {
      setFormError('Please enter some text');
      return;
    }
    if (!tags || tags.length === 0) {
      setFormError('Please add at least one tag');
      return;
    }

    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const success = await entriesService.createEntry({
      text: newEntryText,
      tags,
      date: dateStr,
      visibility,
      diaryId: currentDiaryId
    });

    if (success) {
      setNewEntryText('');
      setTags([]);
      setVisibility(config.defaultVisibility || 'private');
      onSuccess();
    } else {
      setFormError('Failed to save entry. Please try again.');
    }
  }, [newEntryText, tags, selectedDate, visibility, currentDiaryId, config.defaultVisibility, entriesService, onSuccess]);

  return {
    newEntryText,
    setNewEntryText,
    tags,
    setTags,
    selectedDate,
    setSelectedDate,
    visibility,
    setVisibility,
    formError,
    setFormError,
    handleSubmit
  };
};

/**
 * Hook to manage entry editing
 */
export const useEntryEdit = (onSave: () => void) => {
  const { entriesService } = useApiServices();
  
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('private');

  const handleEdit = useCallback((entry: Entry) => {
    setEditingEntry(entry);
    setEditText(entry.content);
    setEditTags(entry.tags || []);
    setEditVisibility(entry.visibility || 'private');
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
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editText.trim() || editTags.length === 0) {
      alert('Text and at least one tag are required');
      return;
    }
    if (!editDate || !editingEntry) return;

    const dateStr = `${editDate.getFullYear()}-${String(editDate.getMonth() + 1).padStart(2, '0')}-${String(editDate.getDate()).padStart(2, '0')}`;
    
    const success = await entriesService.updateEntry(editingEntry.id, {
      text: editText,
      tags: editTags,
      date: dateStr,
      visibility: editVisibility
    });

    if (success) {
      handleCancelEdit();
      onSave();
    } else {
      alert('Failed to update entry.');
    }
  }, [editText, editTags, editDate, editVisibility, editingEntry, entriesService, handleCancelEdit, onSave]);

  const handleToggleVisibility = useCallback(async (
    entry: Entry,
    setEntries: React.Dispatch<React.SetStateAction<Entry[]>>
  ) => {
    const newVisibility = entry.visibility === 'public' ? 'private' : 'public';
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, visibility: newVisibility } : e));

    const success = await entriesService.toggleVisibility(entry.id, newVisibility);
    if (!success) {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, visibility: entry.visibility } : e));
    }
  }, [entriesService]);

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
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleToggleVisibility
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

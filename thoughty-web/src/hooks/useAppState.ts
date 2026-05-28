import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Config, Entry, Diary, ProfileStats, GroupedEntries, SourceEntryInfo, ArchiveStatusFilter } from '../types';
import { getTranslation } from '../utils/translations';
import { useApiServices } from './useApiServices';
export { useApiServices } from './useApiServices';
export { useEntryForm, useEntryEdit, useDeleteModal, useBulkSelect } from './useEntryActions';

const CONFIG_QUERY_KEY = ['app', 'config'] as const;
const PROFILE_STATS_QUERY_KEY = ['app', 'profile-stats'] as const;
const DIARIES_QUERY_KEY = ['app', 'diaries'] as const;
const ENTRY_DATES_QUERY_KEY = ['app', 'entry-dates'] as const;
const ENTRY_YEARS_MONTHS_QUERY_KEY = ['app', 'entry-years-months'] as const;
const ENTRIES_QUERY_KEY = 'entries';
const EMPTY_DIARIES: Diary[] = [];
const EMPTY_ENTRIES: Entry[] = [];
const EMPTY_STRINGS: string[] = [];
const EMPTY_NUMBERS: number[] = [];

/**
 * Hook to manage app configuration
 */
export const useConfig = (isAuthenticated: boolean) => {
  const { configService } = useApiServices();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: async (): Promise<Config> => {
      const data = await configService.fetchConfig();
      return data ?? {};
    },
    enabled: isAuthenticated,
  });

  const profileStatsQuery = useQuery({
    queryKey: PROFILE_STATS_QUERY_KEY,
    queryFn: async (): Promise<ProfileStats | null> => {
      const stats = await configService.fetchProfileStats();
      return stats ?? null;
    },
    enabled: isAuthenticated,
  });

  const config = configQuery.data ?? {};
  const profileStats = profileStatsQuery.data ?? null;

  const fetchConfig = useCallback(async () => {
    return configQuery.refetch();
  }, [configQuery]);

  const fetchProfileStats = useCallback(async () => {
    return profileStatsQuery.refetch();
  }, [profileStatsQuery]);

  const setConfig = useCallback((nextConfig: Config) => {
    queryClient.setQueryData<Config>(CONFIG_QUERY_KEY, nextConfig);
  }, [queryClient]);

  const updateConfig = useCallback(async (newConfig: Config) => {
    const previousConfig = queryClient.getQueryData<Config>(CONFIG_QUERY_KEY) ?? {};
    queryClient.setQueryData<Config>(CONFIG_QUERY_KEY, newConfig);
    const success = await configService.updateConfig(newConfig);
    if (!success) {
      queryClient.setQueryData<Config>(CONFIG_QUERY_KEY, previousConfig);
    }
  }, [configService, queryClient]);

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
    return getTranslation(config.language || 'en', key, params);
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
export const useDiaries = (isAuthenticated: boolean, suppressDefaultDiarySelection = false) => {
  const { diariesService } = useApiServices();
  const queryClient = useQueryClient();
  const [currentDiaryId, setCurrentDiaryId] = useState<number | null>(null);
  const hasInitializedDiarySelection = useRef(false);

  const diariesQuery = useQuery({
    queryKey: DIARIES_QUERY_KEY,
    queryFn: async (): Promise<Diary[]> => {
      const data = await diariesService.fetchDiaries();
      return data ?? [];
    },
    enabled: isAuthenticated,
  });

  const diaries = diariesQuery.data ?? EMPTY_DIARIES;

  const fetchDiaries = useCallback(async () => {
    return diariesQuery.refetch();
  }, [diariesQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    hasInitializedDiarySelection.current = false;
  }, [isAuthenticated]);

  useEffect(() => {
    if (hasInitializedDiarySelection.current) {
      return;
    }

    if (!diariesQuery.isFetched) {
      return;
    }

    if (diaries.length === 0) {
      return;
    }

    hasInitializedDiarySelection.current = true;

    if (!suppressDefaultDiarySelection && currentDiaryId === null && diaries.length > 0) {
      const defaultDiary = diaries.find(d => d.is_default);
      if (defaultDiary) setCurrentDiaryId(defaultDiary.id);
    }
  }, [currentDiaryId, diaries, diariesQuery.isFetched, suppressDefaultDiarySelection]);

  const handleCreateDiary = useCallback(async (diaryData: Partial<Diary>) => {
    const result = await diariesService.createDiary(diaryData);
    if (!result.success) throw new Error(result.error);
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
  }, [diariesService, queryClient]);

  const handleUpdateDiary = useCallback(async (id: number, diaryData: Partial<Diary>) => {
    const result = await diariesService.updateDiary(id, diaryData);
    if (!result.success) throw new Error(result.error);
    queryClient.setQueryData<Diary[]>(DIARIES_QUERY_KEY, (previousDiaries = []) => (
      previousDiaries.map((diary) => (diary.id === id ? { ...diary, ...diaryData } : diary))
    ));
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
  }, [diariesService, queryClient]);

  const handleDeleteDiary = useCallback(async (id: number, refreshEntries: () => void) => {
    const result = await diariesService.deleteDiary(id);
    if (!result.success) throw new Error(result.error);
    if (currentDiaryId === id) {
      const defaultDiary = diaries.find(d => d.is_default);
      setCurrentDiaryId(defaultDiary?.id || null);
    }
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
    refreshEntries();
  }, [diariesService, currentDiaryId, diaries, queryClient]);

  const handleSetDefaultDiary = useCallback(async (id: number) => {
    const result = await diariesService.setDefaultDiary(id);
    if (!result.success) throw new Error(result.error);
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
  }, [diariesService, queryClient]);

  const handleReorderDiaries = useCallback(async (orderedIds: number[]) => {
    const result = await diariesService.reorderDiaries(orderedIds);
    if (!result.success) throw new Error(result.error);
    await queryClient.invalidateQueries({ queryKey: DIARIES_QUERY_KEY });
  }, [diariesService, queryClient]);

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
  const queryClient = useQueryClient();
  
  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');
  
  // Filter state
  const [search, setSearch] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDateObj, setFilterDateObj] = useState<Date | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [filterFavorites, setFilterFavorites] = useState<boolean>(false);
  const [filterArchiveStatus, setFilterArchiveStatus] = useState<ArchiveStatusFilter>('active');
  
  // Navigation state
  const [targetEntryId, setTargetEntryId] = useState<number | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<number | null>(null);
  const [sourceEntry, setSourceEntry] = useState<SourceEntryInfo | null>(null);

  const getLimit = useCallback(() => {
    return typeof config.entriesPerPage === 'number' 
      ? config.entriesPerPage 
      : Number.parseInt(config.entriesPerPage || '10', 10) || 10;
  }, [config.entriesPerPage]);

  const entriesQueryKey = useMemo(() => [
    'app',
    ENTRIES_QUERY_KEY,
    {
      page,
      limit: getLimit(),
      search,
      filterTags,
      filterDate: filterDateObj
        ? `${filterDateObj.getFullYear()}-${String(filterDateObj.getMonth() + 1).padStart(2, '0')}-${String(filterDateObj.getDate()).padStart(2, '0')}`
        : '',
      filterVisibility,
      filterFavorites,
      filterArchiveStatus,
      currentDiaryId,
    },
  ] as const, [currentDiaryId, filterArchiveStatus, filterDateObj, filterFavorites, filterTags, filterVisibility, getLimit, page, search]);

  const entriesQuery = useQuery({
    queryKey: entriesQueryKey,
    queryFn: async (): Promise<{ entries: Entry[]; totalPages: number; allTags: string[] }> => {
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
        archiveStatus: filterArchiveStatus,
        diaryId: currentDiaryId,
      });

      return result ?? { entries: [], totalPages: 1, allTags: [] };
    },
    enabled: isAuthenticated,
  });

  const entryDatesQuery = useQuery({
    queryKey: ENTRY_DATES_QUERY_KEY,
    queryFn: async (): Promise<string[]> => {
      const dates = await entriesService.fetchEntryDates();
      return dates ?? [];
    },
    enabled: isAuthenticated,
  });

  const yearsMonthsQuery = useQuery({
    queryKey: ENTRY_YEARS_MONTHS_QUERY_KEY,
    queryFn: async (): Promise<{ years: number[]; months: string[] }> => {
      const data = await entriesService.fetchYearsMonths();
      return data ?? { years: [], months: [] };
    },
    enabled: isAuthenticated,
  });

  const entries = entriesQuery.data?.entries ?? EMPTY_ENTRIES;
  const totalPages = entriesQuery.data?.totalPages ?? 1;
  const allTags = entriesQuery.data?.allTags ?? EMPTY_STRINGS;
  const entryDates = entryDatesQuery.data ?? EMPTY_STRINGS;
  const loading = !isAuthenticated || entriesQuery.isLoading || entriesQuery.isFetching;
  const availableYears = yearsMonthsQuery.data?.years ?? EMPTY_NUMBERS;
  const availableMonths = yearsMonthsQuery.data?.months ?? EMPTY_STRINGS;

  const setEntries = useCallback((nextEntries: Entry[] | ((previousEntries: Entry[]) => Entry[])) => {
    queryClient.setQueryData<{ entries: Entry[]; totalPages: number; allTags: string[] }>(
      entriesQueryKey,
      (currentData) => {
        const resolvedEntries = typeof nextEntries === 'function'
          ? nextEntries(currentData?.entries ?? [])
          : nextEntries;

        return {
          entries: resolvedEntries,
          totalPages: currentData?.totalPages ?? 1,
          allTags: currentData?.allTags ?? [],
        };
      },
    );
  }, [entriesQueryKey, queryClient]);

  const fetchEntryDates = useCallback(async () => {
    return entryDatesQuery.refetch();
  }, [entryDatesQuery]);

  const fetchEntries = useCallback(async () => {
    return entriesQuery.refetch();
  }, [entriesQuery]);

  const refreshEntryQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['app', ENTRIES_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: ENTRY_DATES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ENTRY_YEARS_MONTHS_QUERY_KEY }),
    ]);
  }, [queryClient]);

  const toggleVisibility = useCallback(async (entry: Entry) => {
    const newVisibility = entry.visibility === 'public' ? 'private' : 'public';
    const success = await entriesService.toggleVisibility(entry.id, newVisibility);
    if (success) {
      await refreshEntryQueries();
    }
  }, [entriesService, refreshEntryQueries]);

  const toggleFavorite = useCallback(async (entry: Entry) => {
    const newFavorite = !entry.is_favorite;
    const success = await entriesService.toggleFavorite(entry.id, newFavorite);
    if (success) {
      await refreshEntryQueries();
    }
  }, [entriesService, refreshEntryQueries]);

  const toggleArchived = useCallback(async (entry: Entry) => {
    const newArchived = !entry.is_archived;
    const success = await entriesService.toggleArchived(entry.id, newArchived);
    if (success) {
      await refreshEntryQueries();
    }
  }, [entriesService, refreshEntryQueries]);

  const fetchEntryHistory = useCallback(async (entryId: number) => {
    return entriesService.fetchEntryHistory(entryId);
  }, [entriesService]);

  const deleteRevision = useCallback(async (entryId: number, revisionId: number) => {
    return entriesService.deleteRevision(entryId, revisionId);
  }, [entriesService]);

  const reorderEntries = useCallback(async (date: string, orderedIds: number[]) => {
    // Optimistic update: reorder locally first
    setEntries(prev => {
      const updated = [...prev];
      const dateEntries = updated.filter(e => {
        const d = e.date.includes('T') ? e.date.split('T')[0] : e.date;
        return d === date;
      });
      const indexMap = new Map(orderedIds.map((id, i) => [id, i + 1]));
      for (const entry of dateEntries) {
        const newIndex = indexMap.get(entry.id);
        if (newIndex !== undefined) {
          entry.index = newIndex;
        }
      }
      return updated;
    });

    const success = await entriesService.reorderEntries(date, orderedIds);
    if (!success) {
      // Revert on failure
      await refreshEntryQueries();
    }
  }, [entriesService, refreshEntryQueries, setEntries]);

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

  // Scroll to target entry
  useEffect(() => {
    if (targetEntryId && !loading && entries.length > 0) {
      const entryElement = document.getElementById(`entry-${targetEntryId}`);
      if (entryElement) {
        if (typeof entryElement.scrollIntoView === 'function') {
          entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const clearTargetTimeout = globalThis.setTimeout(() => {
          setTargetEntryId(null);
        }, 4000);

        return () => {
          globalThis.clearTimeout(clearTargetTimeout);
        };
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
    filterArchiveStatus,
    setFilterArchiveStatus,
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
    toggleArchived,
    fetchEntryHistory,
    deleteRevision,
    reorderEntries
  };
};


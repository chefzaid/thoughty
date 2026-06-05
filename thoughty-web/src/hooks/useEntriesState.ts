import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ArchiveStatusFilter, Config, Entry, GroupedEntries, SourceEntryInfo } from '../types';
import { useApiServices } from './useApiServices';

const ENTRY_DATES_QUERY_KEY = ['app', 'entry-dates'] as const;
const ENTRY_YEARS_MONTHS_QUERY_KEY = ['app', 'entry-years-months'] as const;
const ENTRIES_QUERY_KEY = 'entries';
const EMPTY_ENTRIES: Entry[] = [];
const EMPTY_STRINGS: string[] = [];
const EMPTY_NUMBERS: number[] = [];

export const useEntries = (
  isAuthenticated: boolean,
  config: Config,
  currentDiaryId: number | null,
) => {
  const { entriesService } = useApiServices();
  const queryClient = useQueryClient();

  const [page, setPage] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1');

  const [search, setSearch] = useState<string>('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDateObj, setFilterDateObj] = useState<Date | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [filterFavorites, setFilterFavorites] = useState<boolean>(false);
  const [filterArchiveStatus, setFilterArchiveStatus] = useState<ArchiveStatusFilter>('active');

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
    setEntries(prev => {
      const updated = [...prev];
      const dateEntries = updated.filter(e => {
        const normalizedDate = e.date.includes('T') ? e.date.split('T')[0] : e.date;
        return normalizedDate === date;
      });
      const indexMap = new Map(orderedIds.map((id, index) => [id, index + 1]));
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
      await refreshEntryQueries();
    }
  }, [entriesService, refreshEntryQueries, setEntries]);

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

  useEffect(() => {
    setInputPage(page.toString());
  }, [page]);

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
    entries,
    setEntries,
    groupedEntries,
    loading,
    allTags,
    entryDates,
    page,
    setPage,
    totalPages,
    inputPage,
    setInputPage,
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
    availableYears,
    availableMonths,
    targetEntryId,
    setTargetEntryId,
    activeTargetId,
    setActiveTargetId,
    sourceEntry,
    setSourceEntry,
    fetchEntries,
    fetchEntryDates,
    getLimit,
    entriesService,
    toggleVisibility,
    toggleFavorite,
    toggleArchived,
    fetchEntryHistory,
    deleteRevision,
    reorderEntries,
  };
};
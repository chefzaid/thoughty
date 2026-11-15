import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ArchiveStatusFilter, type Entry, type EntryBacklink, type EntrySearchSort, type GroupedEntries, type SourceEntryInfo } from '../types';
import { useApiServices } from './useApiServices';
import type { SemanticSearchResponse } from '../services/api/aiService';
import { compareSameDayEntries, reassignSameDayIndexes } from '../utils/entryTime';
import type { MoodFilter } from '../utils/entryMood';
import { setTaskLine } from '../utils/taskList';
import type { Notifier } from './useAppNotice';
import type { EntryListQuery } from '../services/api/entryListQuery';
import { formatEntryDate } from '../utils/entryDate';
import { PEOPLE_QUERY_KEY } from '../utils/mentions';
import { ENTRIES_QUERY_KEY, useJournalList } from './useJournalList';
import { useScrollToTarget } from './useScrollToTarget';

export type EntrySearchMode = 'keyword' | 'semantic';
export type SemanticSearchStatus = 'idle' | 'loading' | 'complete' | 'error';

const ENTRY_DATES_QUERY_KEY = ['app', 'entry-dates'] as const;
const ENTRY_YEARS_MONTHS_QUERY_KEY = ['app', 'entry-years-months'] as const;
/** Every query that reads journal entries, for screens that bring entries back from elsewhere. */
export const JOURNAL_ENTRY_QUERY_KEYS = [['app', ENTRIES_QUERY_KEY], ENTRY_DATES_QUERY_KEY, ENTRY_YEARS_MONTHS_QUERY_KEY, PEOPLE_QUERY_KEY] as const;
const EMPTY_STRINGS: string[] = [];
const EMPTY_NUMBERS: number[] = [];

const normalizeEntryDate = (date: string): string =>
  date.includes('T') ? (date.split('T')[0] ?? date) : date;

interface UseEntriesOptions {
  /** Whether the profile config has arrived (or failed to), so the list asks once with the user's settings. */
  configLoaded?: boolean;
  /** Whether the diary and route filters are settled, so the list does not ask for a diary it is about to leave. */
  filtersReady?: boolean;
  /** The journal permalink being opened: the list waits until it opens around that entry. */
  routeEntryId?: number;
  /** The person the journal address names (null for none); undefined away from the journal. The list waits for it to apply. */
  routePersonId?: number | null;
  /** Hears that the entry a jump opened the list at is not among the entries shown; the list starts at its top. */
  onEntryMissing?: () => void;
}

export const useEntries = (
  isAuthenticated: boolean,
  currentDiaryId: number | null,
  { notify, t }: Notifier,
  { configLoaded = true, filtersReady = true, routeEntryId, routePersonId, onEntryMissing }: UseEntriesOptions = {},
) => {
  const { entriesService, aiService } = useApiServices();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState<string>('');
  const [searchModeState, setSearchModeState] = useState<EntrySearchMode>('keyword');
  const [searchSort, setSearchSort] = useState<EntrySearchSort>('relevance');
  const [semanticSearchStatus, setSemanticSearchStatus] = useState<SemanticSearchStatus>('idle');
  const [semanticSearchResult, setSemanticSearchResult] = useState<SemanticSearchResponse | null>(null);
  const semanticRequestIdRef = useRef(0);
  // Ticks not sent yet, by entry and line: a line ticked again before its request leaves sends only its last state.
  const pendingTasksRef = useRef(new Map<number, Map<number, boolean>>());
  const sendingTasksRef = useRef(new Set<number>());
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDateObj, setFilterDateObj] = useState<Date | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [filterFavorites, setFilterFavorites] = useState<boolean>(false);
  const [filterArchiveStatus, setFilterArchiveStatus] = useState<ArchiveStatusFilter>('active');
  const [filterMood, setFilterMood] = useState<MoodFilter>('');
  const [filterEraId, setFilterEraId] = useState<number | null>(null);
  const [filterPersonId, setFilterPersonId] = useState<number | null>(null);

  const [targetEntryId, setTargetEntryId] = useState<number | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<number | null>(null);
  const [sourceEntry, setSourceEntry] = useState<SourceEntryInfo | null>(null);
  const [handledPermalinkEntryId, setHandledPermalinkEntryId] = useState<number | null>(null);

  // The first list request waits for everything that decides it, so it is sent once instead of
  // being sent with defaults and thrown away when the settings, the diary or the permalink arrive.
  const permalinkPending = routeEntryId !== undefined && handledPermalinkEntryId !== routeEntryId;
  const personPending = routePersonId !== undefined && routePersonId !== filterPersonId;
  // A jump that shows every entry (a cross-reference) holds the list until its filters have all been reset
  const [filtersResetting, setFiltersResetting] = useState(false);
  const listReady = configLoaded && filtersReady && !permalinkPending && !personPending && !filtersResetting;

  const semanticEntryIds = useMemo(() => (
    searchModeState === 'semantic'
      ? semanticSearchResult?.matches.map((match) => match.entryId) ?? null
      : null
  ), [searchModeState, semanticSearchResult]);
  const effectiveKeywordSearch = searchModeState === 'keyword' ? search : '';
  /** Keyword results are shown in the server's order (best match first) instead of grouped by day. */
  const rankedResults = effectiveKeywordSearch.trim() !== '' && searchSort === 'relevance';

  /** The list's filters, as `GET /api/entries` reads them; the random entry picks among the same. */
  const listQuery = useMemo((): EntryListQuery => ({
    search: effectiveKeywordSearch,
    // Sent only with a search, so changing it alone does not read the list again
    sort: effectiveKeywordSearch.trim() ? searchSort : undefined,
    filterTags,
    filterDate: filterDateObj ? formatEntryDate(filterDateObj) : '',
    filterVisibility: filterVisibility === 'all' ? '' : filterVisibility,
    favorites: filterFavorites,
    archiveStatus: filterArchiveStatus,
    mood: filterMood,
    eraId: filterEraId,
    personId: filterPersonId,
    diaryId: currentDiaryId,
    entryIds: semanticEntryIds,
  }), [currentDiaryId, effectiveKeywordSearch, filterArchiveStatus, filterDateObj, filterEraId, filterFavorites, filterMood, filterPersonId, filterTags, filterVisibility, searchSort, semanticEntryIds]);

  const onAnchorMissing = useCallback(() => {
    setTargetEntryId(null);
    setActiveTargetId(null);
    setSourceEntry(null);
    onEntryMissing?.();
  }, [onEntryMissing]);
  const list = useJournalList({ enabled: isAuthenticated && listReady, listQuery, onAnchorMissing });
  const { entries, setEntries, refetch: refetchList } = list;

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

  const entryDates = entryDatesQuery.data ?? EMPTY_STRINGS;
  const loading = !isAuthenticated
    || !listReady
    || list.reloading
    || semanticSearchStatus === 'loading';
  const availableYears = yearsMonthsQuery.data?.years ?? EMPTY_NUMBERS;
  const availableMonths = yearsMonthsQuery.data?.months ?? EMPTY_STRINGS;

  const fetchEntryDates = useCallback(async () => {
    return entryDatesQuery.refetch();
  }, [entryDatesQuery]);

  const fetchEntries = useCallback(async () => {
    // A saved or edited entry can mention other people, so their counts are read again too
    void queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEY });
    return refetchList();
  }, [queryClient, refetchList]);

  const setSearchMode = useCallback((mode: EntrySearchMode) => {
    semanticRequestIdRef.current += 1;
    setSearchModeState(mode);
    setSemanticSearchResult(null);
    setSemanticSearchStatus('idle');
  }, []);

  const runSemanticSearch = useCallback(async () => {
    const query = search.trim();
    if (query.length < 2) {
      setSemanticSearchResult(null);
      setSemanticSearchStatus('idle');
      return;
    }

    const requestId = ++semanticRequestIdRef.current;
    setSemanticSearchStatus('loading');
    const result = await aiService.semanticSearch(query, currentDiaryId ?? undefined);
    if (requestId !== semanticRequestIdRef.current) return;

    setSemanticSearchResult(result);
    setSemanticSearchStatus(result ? 'complete' : 'error');
  }, [aiService, currentDiaryId, search]);

  const refreshEntryQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['app', ENTRIES_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: ENTRY_DATES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ENTRY_YEARS_MONTHS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEY }),
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

  const togglePinned = useCallback(async (entry: Entry) => {
    const newPinned = !entry.is_pinned;
    const result = await entriesService.togglePinned(entry.id, newPinned);
    if (result.success) {
      await refreshEntryQueries();
      return;
    }

    notify(t(result.error || 'pinUpdateFailed'));
  }, [entriesService, notify, refreshEntryQueries, t]);

  /** Opens a sealed time capsule early; the writer confirmed it on the card. */
  const unsealEntry = useCallback(async (entry: Entry) => {
    const result = await entriesService.unsealEntry(entry.id);
    if (result.success) {
      await refreshEntryQueries();
    }
    notify(t(result.success ? 'timeCapsuleOpened' : result.error || 'timeCapsuleOpenFailed'));
  }, [entriesService, notify, refreshEntryQueries, t]);

  /** Sends an entry's waiting ticks one after the other, so the server applies them in order. */
  const sendEntryTasks = useCallback(async (entryId: number) => {
    if (sendingTasksRef.current.has(entryId)) {
      return;
    }
    sendingTasksRef.current.add(entryId);

    let failure: { error?: string } | null = null;
    try {
      const pending = pendingTasksRef.current.get(entryId);
      while (pending && pending.size > 0 && !failure) {
        const [line, checked] = pending.entries().next().value as [number, boolean];
        pending.delete(line);
        const result = await entriesService.setEntryTask(entryId, line, checked);
        if (!result.success) {
          failure = result;
        }
      }
    } finally {
      pendingTasksRef.current.delete(entryId);
      sendingTasksRef.current.delete(entryId);
    }

    if (failure) {
      // Back to what the server holds, for this list and every other one
      await refreshEntryQueries();
      notify(t(failure.error || 'taskUpdateFailed'));
      return;
    }

    // This list already shows the ticks; the others read the entry again when they are next shown
    await queryClient.invalidateQueries({ queryKey: ['app', ENTRIES_QUERY_KEY], refetchType: 'none' });
  }, [entriesService, notify, queryClient, refreshEntryQueries, t]);

  /** Ticks or unticks a task list item of a Markdown entry at once, and saves it in the background. */
  const setEntryTask = useCallback((entry: Entry, line: number, checked: boolean) => {
    setEntries((previous) => previous.map((current) => {
      const content = current.id === entry.id ? setTaskLine(current.content, line, checked) : null;
      return content === null ? current : { ...current, content };
    }));

    const pending = pendingTasksRef.current.get(entry.id) ?? new Map<number, boolean>();
    pending.set(line, checked);
    pendingTasksRef.current.set(entry.id, pending);
    void sendEntryTasks(entry.id);
  }, [sendEntryTasks, setEntries]);

  const fetchEntryHistory = useCallback(async (entryId: number) => {
    return entriesService.fetchEntryHistory(entryId);
  }, [entriesService]);

  const fetchEntryBacklinks = useCallback(async (entryId: number): Promise<EntryBacklink[]> => {
    return entriesService.fetchEntryBacklinks(entryId);
  }, [entriesService]);

  // Bumped once an entry is written or removed, so every card shown reads its backlinks again
  const [backlinksVersion, setBacklinksVersion] = useState(0);
  const refreshBacklinks = useCallback(() => setBacklinksVersion((version) => version + 1), []);

  const deleteRevision = useCallback(async (entryId: number, revisionId: number) => {
    return entriesService.deleteRevision(entryId, revisionId);
  }, [entriesService]);

  const reorderEntries = useCallback(async (date: string, orderedIds: number[]) => {
    setEntries(prev => {
      const dayEntries = prev.filter((entry) => normalizeEntryDate(entry.date) === date);
      const indexMap = reassignSameDayIndexes(dayEntries, orderedIds);

      const reorderedDateEntries = dayEntries
        .map((entry) => ({
          ...entry,
          index: indexMap.get(entry.id) ?? entry.index,
        }))
        .sort(compareSameDayEntries);

      if (reorderedDateEntries.length === 0) {
        return prev;
      }

      const nextEntries: Entry[] = [];
      let insertedReorderedDay = false;

      for (const entry of prev) {
        if (normalizeEntryDate(entry.date) !== date) {
          nextEntries.push(entry);
          continue;
        }

        if (!insertedReorderedDay) {
          nextEntries.push(...reorderedDateEntries);
          insertedReorderedDay = true;
        }
      }

      return nextEntries;
    });

    const success = await entriesService.reorderEntries(date, orderedIds);
    if (!success) {
      await refreshEntryQueries();
    }
  }, [entriesService, refreshEntryQueries, setEntries]);

  const groupedEntries: GroupedEntries = useMemo(() => {
    const grouped = entries.reduce((acc: GroupedEntries, entry) => {
      const dateStr = normalizeEntryDate(entry.date);
      acc[dateStr] ??= [];
      acc[dateStr]?.push(entry);
      return acc;
    }, {});

    Object.keys(grouped).forEach(date => {
      grouped[date]?.sort(compareSameDayEntries);
    });

    return grouped;
  }, [entries]);

  useEffect(() => {
    semanticRequestIdRef.current += 1;
    setSemanticSearchResult(null);
    setSemanticSearchStatus('idle');
  }, [currentDiaryId, search]);

  const clearTarget = useCallback(() => setTargetEntryId(null), []);
  useScrollToTarget({ targetEntryId, jump: list.jump, loading, entries, clearTarget });

  return {
    entries,
    listQuery,
    setEntries,
    groupedEntries,
    loading,
    allTags: list.allTags,
    entryDates,
    /** The infinite scroll: the entries the filters match, the batches before and after, and loading them. */
    feed: {
      total: list.total,
      offset: list.offset,
      hasOlder: list.hasOlder,
      hasNewer: list.hasNewer,
      loadingOlder: list.loadingOlder,
      loadingNewer: list.loadingNewer,
      loadError: list.loadError,
      loadOlder: list.loadOlder,
      loadNewer: list.loadNewer,
    },
    /** Opens the list around an entry (null: at its start), under the filters set along with it. */
    openListAt: list.openListAt,
    search,
    setSearch,
    searchMode: searchModeState,
    setSearchMode,
    searchSort,
    setSearchSort,
    rankedResults,
    semanticSearchStatus,
    semanticSearchResult,
    runSemanticSearch,
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
    filterMood,
    setFilterMood,
    filterEraId,
    setFilterEraId,
    filterPersonId,
    setFilterPersonId,
    availableYears,
    availableMonths,
    targetEntryId,
    setTargetEntryId,
    activeTargetId,
    setActiveTargetId,
    sourceEntry,
    setSourceEntry,
    handledPermalinkEntryId,
    setHandledPermalinkEntryId,
    filtersResetting,
    setFiltersResetting,
    fetchEntries,
    fetchEntryDates,
    refreshEntryQueries,
    entriesService,
    toggleVisibility,
    toggleFavorite,
    toggleArchived,
    togglePinned,
    unsealEntry,
    setEntryTask,
    fetchEntryHistory,
    fetchEntryBacklinks,
    backlinksVersion,
    refreshBacklinks,
    deleteRevision,
    reorderEntries,
  };
};

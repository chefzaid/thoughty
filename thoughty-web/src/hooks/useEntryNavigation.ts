import { useCallback, useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import type { Entry, SourceEntryInfo, ViewType } from '../types';
import type { useEntries } from './useAppState';
import { getPathForView } from '../types';
import type { TransientMessage } from './useTransientMessage';
import { buildEntryPermalink, ENTRY_PERMALINK_PARAM, toSearchString } from '../utils/appRouting';

type EntriesState = ReturnType<typeof useEntries>;

interface UseEntryNavigationParams {
  currentDiaryId: number | null;
  currentView: ViewType | null;
  entriesService: EntriesState['entriesService'];
  filterArchiveStatus: EntriesState['filterArchiveStatus'];
  filterDateObj: EntriesState['filterDateObj'];
  filterFavorites: EntriesState['filterFavorites'];
  filterMood: EntriesState['filterMood'];
  filterEraId: EntriesState['filterEraId'];
  filterPersonId: EntriesState['filterPersonId'];
  filterTags: EntriesState['filterTags'];
  filterVisibility: EntriesState['filterVisibility'];
  /** Says that the entry to open could not be found. */
  entryToast: TransientMessage;
  /** The permalink that has landed; the entries list waits for the one in the route to land. */
  handledPermalinkEntryId: EntriesState['handledPermalinkEntryId'];
  isAuthenticated: boolean;
  navigate: NavigateFunction;
  openListAt: EntriesState['openListAt'];
  routeEntryId: number | undefined;
  search: EntriesState['search'];
  searchParams: URLSearchParams;
  setActiveTargetId: EntriesState['setActiveTargetId'];
  setCurrentDiaryId: React.Dispatch<React.SetStateAction<number | null>>;
  setFilterArchiveStatus: EntriesState['setFilterArchiveStatus'];
  setFilterDateObj: EntriesState['setFilterDateObj'];
  setFilterFavorites: EntriesState['setFilterFavorites'];
  setFilterMood: EntriesState['setFilterMood'];
  setFilterEraId: EntriesState['setFilterEraId'];
  setFilterPersonId: EntriesState['setFilterPersonId'];
  setFilterTags: EntriesState['setFilterTags'];
  setFilterVisibility: EntriesState['setFilterVisibility'];
  setHandledPermalinkEntryId: EntriesState['setHandledPermalinkEntryId'];
  /** Whether the list waits for the filters a jump resets; set while they change over. */
  filtersResetting: EntriesState['filtersResetting'];
  setFiltersResetting: EntriesState['setFiltersResetting'];
  setSearch: EntriesState['setSearch'];
  setSourceEntry: EntriesState['setSourceEntry'];
  setTargetEntryId: EntriesState['setTargetEntryId'];
  sourceEntry: EntriesState['sourceEntry'];
  t: (key: string) => string;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!globalThis.navigator.clipboard?.writeText) {
    return false;
  }

  await globalThis.navigator.clipboard.writeText(text);
  return true;
}

export function useEntryNavigation({
  currentDiaryId,
  currentView,
  entriesService,
  filterArchiveStatus,
  filterDateObj,
  filterFavorites,
  filterMood,
  filterEraId,
  filterPersonId,
  filterTags,
  filterVisibility,
  entryToast,
  handledPermalinkEntryId,
  isAuthenticated,
  navigate,
  openListAt,
  routeEntryId,
  search,
  searchParams,
  setActiveTargetId,
  setCurrentDiaryId,
  setFilterArchiveStatus,
  setFilterDateObj,
  setFilterFavorites,
  setFilterMood,
  setFilterEraId,
  setFilterPersonId,
  setFilterTags,
  setFilterVisibility,
  setHandledPermalinkEntryId,
  filtersResetting,
  setFiltersResetting,
  setSearch,
  setSourceEntry,
  setTargetEntryId,
  sourceEntry,
  t,
}: Readonly<UseEntryNavigationParams>) {
  const showEntryNotFoundToast = entryToast.show;

  const needsJournalResetForPermalink = useCallback((): boolean => {
    if (search !== '') {
      return true;
    }

    if (filterTags.length > 0) {
      return true;
    }

    if (filterDateObj !== null) {
      return true;
    }

    if (filterVisibility !== 'all') {
      return true;
    }

    if (filterFavorites) {
      return true;
    }

    if (filterMood !== '') {
      return true;
    }

    if (filterEraId !== null || filterPersonId !== null) {
      return true;
    }

    if (filterArchiveStatus !== 'all') {
      return true;
    }

    if (currentDiaryId !== null) {
      return true;
    }

    return currentView === 'journal' && searchParams.get('diary') !== 'all';
  }, [
    currentDiaryId,
    currentView,
    filterDateObj,
    filterArchiveStatus,
    filterEraId,
    filterFavorites,
    filterMood,
    filterPersonId,
    filterTags,
    filterVisibility,
    search,
    searchParams,
  ]);

  const resetJournalFiltersForPermalink = useCallback((): void => {
    if (!needsJournalResetForPermalink()) {
      return;
    }
    // The diary follows the address a render later, so the list waits for every filter to be reset
    setFiltersResetting(true);

    if (search !== '') {
      setSearch('');
    }

    if (filterTags.length > 0) {
      setFilterTags([]);
    }

    if (filterDateObj !== null) {
      setFilterDateObj(null);
    }

    if (filterVisibility !== 'all') {
      setFilterVisibility('all');
    }

    if (filterFavorites) {
      setFilterFavorites(false);
    }

    if (filterMood !== '') {
      setFilterMood('');
    }

    if (filterEraId !== null) {
      setFilterEraId(null);
    }

    if (filterPersonId !== null) {
      setFilterPersonId(null);
    }

    if (filterArchiveStatus !== 'all') {
      setFilterArchiveStatus('all');
    }

    if (currentDiaryId !== null) {
      setCurrentDiaryId(null);
    }

    if (currentView === 'journal') {
      const nextSearchParams = new URLSearchParams(searchParams);

      if (nextSearchParams.get('diary') !== 'all') {
        nextSearchParams.set('diary', 'all');
        navigate({
          pathname: getPathForView('journal'),
          search: toSearchString(nextSearchParams),
        }, { replace: true });
      }
    }
  }, [
    currentDiaryId,
    currentView,
    filterDateObj,
    filterArchiveStatus,
    filterEraId,
    filterFavorites,
    filterMood,
    filterPersonId,
    filterTags,
    filterVisibility,
    navigate,
    needsJournalResetForPermalink,
    search,
    searchParams,
    setCurrentDiaryId,
    setFilterArchiveStatus,
    setFilterDateObj,
    setFilterFavorites,
    setFilterEraId,
    setFilterMood,
    setFilterPersonId,
    setFilterTags,
    setFilterVisibility,
    setFiltersResetting,
    setSearch,
  ]);

  useEffect(() => {
    if (filtersResetting && !needsJournalResetForPermalink()) {
      setFiltersResetting(false);
    }
  }, [filtersResetting, needsJournalResetForPermalink, setFiltersResetting]);

  const clearJournalPermalink = useCallback(() => {
    if (currentView === 'journal' && searchParams.has(ENTRY_PERMALINK_PARAM)) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete(ENTRY_PERMALINK_PARAM);
      navigate({
        pathname: getPathForView('journal'),
        search: toSearchString(nextSearchParams),
      }, { replace: true });
      setHandledPermalinkEntryId(null);
    }
  }, [currentView, navigate, searchParams, setHandledPermalinkEntryId]);

  /** Opens the list around an entry and highlights it, keeping the filters as they are now. */
  const openEntry = useCallback((entryId: number) => {
    openListAt(entryId);
    setTargetEntryId(entryId);
    setActiveTargetId(entryId);
  }, [openListAt, setActiveTargetId, setTargetEntryId]);

  const executeEntryNavigation = useCallback(async (
    date: string,
    index: number,
  ) => {
    const data = await entriesService.navigateByDate(date, index);
    if (data?.found && data.entryId) {
      openEntry(data.entryId);
    } else {
      showEntryNotFoundToast();
      setSourceEntry(null);
      setActiveTargetId(null);
    }
  }, [entriesService, openEntry, setActiveTargetId, setSourceEntry, showEntryNotFoundToast]);

  const handleBackToSource = useCallback(() => {
    if (!sourceEntry) {
      return;
    }

    openListAt(sourceEntry.id);
    setTargetEntryId(sourceEntry.id);
    setSourceEntry(null);
    setActiveTargetId(null);
  }, [openListAt, setActiveTargetId, setSourceEntry, setTargetEntryId, sourceEntry]);

  const handleShareEntry = useCallback(async (entry: Entry): Promise<boolean> => {
    const url = buildEntryPermalink(entry.id);

    try {
      if (typeof globalThis.navigator.share === 'function') {
        // A titled entry is shared under its title, so the link reads as the entry it opens
        await globalThis.navigator.share({
          title: entry.title || t('shareEntry'),
          ...(entry.title ? { text: entry.title } : {}),
          url,
        });
        return true;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return false;
      }
    }

    try {
      return await copyTextToClipboard(url);
    } catch (error) {
      console.error('Error sharing entry:', error);
      return false;
    }
  }, [t]);

  const handleNavigateToEntry = useCallback(async (
    date: string,
    index: number = 1,
    sourceEntryInfo: SourceEntryInfo | null = null,
  ) => {
    clearJournalPermalink();

    if (sourceEntryInfo) {
      setSourceEntry({
        id: sourceEntryInfo.id,
        date: sourceEntryInfo.date,
        index: sourceEntryInfo.index,
      });
    }

    if (needsJournalResetForPermalink()) {
      resetJournalFiltersForPermalink();
    }

    await executeEntryNavigation(date, index);
  }, [clearJournalPermalink, executeEntryNavigation, needsJournalResetForPermalink, resetJournalFiltersForPermalink, setSourceEntry]);

  /**
   * Opens the list around an entry as it is filtered now (the random entry), leaving the filters, the diary
   * and the search alone, unlike a permalink, which opens its entry among all entries.
   */
  const handleOpenEntryInList = useCallback((entryId: number) => {
    clearJournalPermalink();
    setActiveTargetId(null);
    openListAt(entryId);
    setTargetEntryId(entryId);
  }, [clearJournalPermalink, openListAt, setActiveTargetId, setTargetEntryId]);

  useEffect(() => {
    if (routeEntryId === undefined) {
      if (handledPermalinkEntryId !== null) {
        setHandledPermalinkEntryId(null);
      }
      return;
    }

    // Once the permalink has landed, scrolling from it and later filter changes are left alone
    if (!isAuthenticated || handledPermalinkEntryId === routeEntryId) {
      return;
    }

    if (needsJournalResetForPermalink()) {
      resetJournalFiltersForPermalink();
      return;
    }

    // The list opens around the entry; one the API cannot find leaves the list at its start, with a toast
    openEntry(routeEntryId);
    setHandledPermalinkEntryId(routeEntryId);
  }, [handledPermalinkEntryId, isAuthenticated, needsJournalResetForPermalink, openEntry, resetJournalFiltersForPermalink, routeEntryId, setHandledPermalinkEntryId]);

  return {
    handleBackToSource,
    handleNavigateToEntry,
    handleOpenEntryInList,
    handleShareEntry,
  };
}
import { useCallback, useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import type { Entry, SourceEntryInfo, ViewType } from '../types';
import type { useEntries } from './useAppState';
import { getPathForView } from '../types';
import { useTransientMessage } from './useTransientMessage';
import { buildEntryPermalink, ENTRY_PERMALINK_PARAM, toSearchString } from '../utils/appRouting';

type EntriesState = ReturnType<typeof useEntries>;

interface UseEntryNavigationParams {
  currentDiaryId: number | null;
  currentView: ViewType | null;
  entries: EntriesState['entries'];
  entriesService: EntriesState['entriesService'];
  filterArchiveStatus: EntriesState['filterArchiveStatus'];
  filterDateObj: EntriesState['filterDateObj'];
  filterFavorites: EntriesState['filterFavorites'];
  filterTags: EntriesState['filterTags'];
  filterVisibility: EntriesState['filterVisibility'];
  getLimit: EntriesState['getLimit'];
  isAuthenticated: boolean;
  loading: EntriesState['loading'];
  navigate: NavigateFunction;
  page: EntriesState['page'];
  routeEntryId: number | undefined;
  search: EntriesState['search'];
  searchParams: URLSearchParams;
  setActiveTargetId: EntriesState['setActiveTargetId'];
  setCurrentDiaryId: React.Dispatch<React.SetStateAction<number | null>>;
  setFilterArchiveStatus: EntriesState['setFilterArchiveStatus'];
  setFilterDateObj: EntriesState['setFilterDateObj'];
  setFilterFavorites: EntriesState['setFilterFavorites'];
  setFilterTags: EntriesState['setFilterTags'];
  setFilterVisibility: EntriesState['setFilterVisibility'];
  setPage: EntriesState['setPage'];
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
  entries,
  entriesService,
  filterArchiveStatus,
  filterDateObj,
  filterFavorites,
  filterTags,
  filterVisibility,
  getLimit,
  isAuthenticated,
  loading,
  navigate,
  page,
  routeEntryId,
  search,
  searchParams,
  setActiveTargetId,
  setCurrentDiaryId,
  setFilterArchiveStatus,
  setFilterDateObj,
  setFilterFavorites,
  setFilterTags,
  setFilterVisibility,
  setPage,
  setSearch,
  setSourceEntry,
  setTargetEntryId,
  sourceEntry,
  t,
}: Readonly<UseEntryNavigationParams>) {
  const entryToast = useTransientMessage();
  const showEntryNotFoundToast = entryToast.show;
  const [handledPermalinkEntryId, setHandledPermalinkEntryId] = useState<number | null>(null);
  const [pendingEntryTarget, setPendingEntryTarget] = useState<{
    date: string;
    index: number;
  } | null>(null);

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

    if (filterArchiveStatus !== 'all') {
      return true;
    }

    if (currentDiaryId !== null) {
      return true;
    }

    if (currentView === 'journal' && searchParams.get('diary') !== 'all') {
      return true;
    }

    return page !== 1;
  }, [
    currentDiaryId,
    currentView,
    filterDateObj,
    filterArchiveStatus,
    filterFavorites,
    filterTags,
    filterVisibility,
    page,
    search,
    searchParams,
  ]);

  const resetJournalFiltersForPermalink = useCallback((): void => {
    if (!needsJournalResetForPermalink()) {
      return;
    }

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

    if (page !== 1) {
      setPage(1);
    }
  }, [
    currentDiaryId,
    currentView,
    filterDateObj,
    filterArchiveStatus,
    filterFavorites,
    filterTags,
    filterVisibility,
    navigate,
    needsJournalResetForPermalink,
    page,
    search,
    searchParams,
    setCurrentDiaryId,
    setFilterArchiveStatus,
    setFilterDateObj,
    setFilterFavorites,
    setFilterTags,
    setFilterVisibility,
    setPage,
    setSearch,
  ]);

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
  }, [currentView, navigate, searchParams]);

  const executeEntryNavigation = useCallback(async (
    date: string,
    index: number,
  ) => {
    const data = await entriesService.navigateByDate(date, index, getLimit());
    if (data?.found) {
      setPage(data.page || 1);
      setTargetEntryId(data.entryId || null);
      setActiveTargetId(data.entryId || null);
    } else {
      showEntryNotFoundToast();
      setSourceEntry(null);
      setActiveTargetId(null);
      setPendingEntryTarget(null);
    }
  }, [entriesService, getLimit, setActiveTargetId, setPage, setSourceEntry, setTargetEntryId, showEntryNotFoundToast]);

  const handleBackToSource = useCallback(async () => {
    if (!sourceEntry) {
      return;
    }

    const data = await entriesService.navigateById(sourceEntry.id, getLimit());
    if (data?.found) {
      setPage(data.page || 1);
      setTargetEntryId(data.entryId || null);
    }

    setSourceEntry(null);
    setActiveTargetId(null);
    setPendingEntryTarget(null);
  }, [entriesService, getLimit, setActiveTargetId, setPage, setSourceEntry, setTargetEntryId, sourceEntry]);

  const handleShareEntry = useCallback(async (entry: Entry): Promise<boolean> => {
    const url = buildEntryPermalink(entry.id);

    try {
      if (typeof globalThis.navigator.share === 'function') {
        await globalThis.navigator.share({
          title: t('shareEntry'),
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

    setPendingEntryTarget({ date, index });

    if (needsJournalResetForPermalink()) {
      resetJournalFiltersForPermalink();
    }

    await executeEntryNavigation(date, index);
  }, [clearJournalPermalink, executeEntryNavigation, needsJournalResetForPermalink, resetJournalFiltersForPermalink, setSourceEntry]);

  useEffect(() => {
    if (!pendingEntryTarget || loading || entries.length === 0) {
      return;
    }

    const matchedEntry = entries.find((entry) => {
      const entryDate = entry.date.includes('T') ? entry.date.split('T')[0] : entry.date;
      return entryDate === pendingEntryTarget.date && (entry.index || 1) === pendingEntryTarget.index;
    });

    if (!matchedEntry) {
      return;
    }

    setTargetEntryId(matchedEntry.id);
    setActiveTargetId(matchedEntry.id);
    setPendingEntryTarget(null);
  }, [entries, loading, pendingEntryTarget, setActiveTargetId, setTargetEntryId]);

  useEffect(() => {
    if (routeEntryId === undefined) {
      if (handledPermalinkEntryId !== null) {
        setHandledPermalinkEntryId(null);
      }
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    if (needsJournalResetForPermalink()) {
      resetJournalFiltersForPermalink();
      return;
    }

    if (handledPermalinkEntryId === routeEntryId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const data = await entriesService.navigateById(routeEntryId, getLimit());
      if (cancelled) {
        return;
      }

      if (data?.found) {
        const resolvedEntryId = data.entryId || routeEntryId;
        setPage(data.page || 1);
        setTargetEntryId(resolvedEntryId);
        setActiveTargetId(resolvedEntryId);
      } else {
        setSourceEntry(null);
        setActiveTargetId(null);
        showEntryNotFoundToast();
      }

      setHandledPermalinkEntryId(routeEntryId);
    })();

    return () => {
      cancelled = true;
    };
  }, [entriesService, getLimit, handledPermalinkEntryId, isAuthenticated, needsJournalResetForPermalink, resetJournalFiltersForPermalink, routeEntryId, setActiveTargetId, setPage, setSourceEntry, setTargetEntryId, showEntryNotFoundToast]);

  return {
    entryToast,
    handleBackToSource,
    handleNavigateToEntry,
    handleShareEntry,
  };
}
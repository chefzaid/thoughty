import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { useSearchParams } from 'react-router-dom';

import type FilterControls from '../FilterControls/FilterControls';
import type { SavedSearch } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { formatDiarySearchParam, parseDiarySearchParam } from '../../types';
import { ENTRY_PERMALINK_PARAM } from '../../utils/appRouting';
import {
  SAVED_SEARCH_PARAM,
  matchesSavedSearch,
  parseSavedSearchDate,
  savedSearchMood,
} from '../../utils/savedSearches';

/** The filter bar's values and setters that a saved search reads and restores. */
export type SavedSearchFilterControls = Pick<ComponentProps<typeof FilterControls>,
  | 'search' | 'setSearch' | 'searchMode' | 'setSearchMode' | 'searchSort' | 'setSearchSort'
  | 'filterTags' | 'setFilterTags' | 'filterDateObj' | 'setFilterDateObj'
  | 'filterVisibility' | 'setFilterVisibility' | 'filterFavorites' | 'setFilterFavorites'
  | 'filterArchiveStatus' | 'setFilterArchiveStatus' | 'filterMood' | 'setFilterMood'
  | 'filterEraId' | 'setFilterEraId' | 'filterPersonId' | 'setFilterPersonId'
  | 'setPage' | 'onSemanticSearch'>;

interface UseSavedSearchRouteOptions {
  /** Undefined until the list has loaded. */
  readonly savedSearches: readonly SavedSearch[] | undefined;
  readonly filters: SavedSearchFilterControls;
  readonly currentDiaryId: number | null;
  readonly notify: (message: string) => void;
  readonly t: TranslationFunction;
}

interface PendingMeaningSearch {
  readonly search: string;
  readonly diaryId: number | null;
}

function parseSavedSearchParam(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get(SAVED_SEARCH_PARAM);
  return raw && /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;
}

/**
 * Keeps the journal URL naming the saved search on screen (`?diary=…&view=<id>`), so the address can be
 * bookmarked or opened on another device: applying a search writes it, opening such a link applies the
 * search, and changing any filter afterwards drops it again. A saved meaning search runs once applied.
 */
export function useSavedSearchRoute({ savedSearches, filters, currentDiaryId, notify, t }: UseSavedSearchRouteOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewId = parseSavedSearchParam(searchParams);
  const [appliedId, setAppliedId] = useState<number | null>(null);
  const [pendingMeaningSearch, setPendingMeaningSearch] = useState<PendingMeaningSearch | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  /** The `view` this hook last wrote, until the URL shows it (router updates can land a render later). */
  const routeTargetRef = useRef<{ readonly viewId: number | null } | null>(null);
  const routeSettled = useCallback((): boolean => {
    if (routeTargetRef.current && routeTargetRef.current.viewId !== viewId) return false;
    routeTargetRef.current = null;
    return true;
  }, [viewId]);

  const shown = viewId !== null && appliedId === viewId
    ? savedSearches?.find((saved) => saved.id === viewId) ?? null
    : null;
  const shownMatches = shown !== null && matchesSavedSearch(shown.filters, filters);

  const restoreFilters = useCallback((saved: SavedSearch) => {
    const controls = filtersRef.current;
    const { filters: values } = saved;
    controls.setSearchMode(values.searchMode);
    controls.setSearch(values.search);
    controls.setSearchSort(values.sort);
    controls.setFilterTags([...values.tags]);
    controls.setFilterDateObj(parseSavedSearchDate(values.date));
    controls.setFilterVisibility(values.visibility);
    controls.setFilterFavorites(values.favorites);
    controls.setFilterArchiveStatus(values.archiveStatus);
    controls.setFilterMood(savedSearchMood(values.mood));
    controls.setFilterEraId(values.eraId ?? null);
    controls.setFilterPersonId(values.personId ?? null);
    controls.setPage(1);
    setPendingMeaningSearch(values.searchMode === 'semantic' && values.search.trim().length >= 2
      ? { search: values.search, diaryId: saved.diaryId }
      : null);
    setAppliedId(saved.id);
  }, []);

  const writeRoute = useCallback((saved: SavedSearch | null) => {
    routeTargetRef.current = { viewId: saved?.id ?? null };
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (saved) {
        next.set('diary', formatDiarySearchParam(saved.diaryId));
        next.set(SAVED_SEARCH_PARAM, String(saved.id));
        next.delete(ENTRY_PERMALINK_PARAM);
      } else {
        next.delete(SAVED_SEARCH_PARAM);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const applySavedSearch = useCallback((saved: SavedSearch) => {
    restoreFilters(saved);
    writeRoute(saved);
  }, [restoreFilters, writeRoute]);

  /** Names a search just saved from the filters on screen, which therefore stay as they are. */
  const markSavedSearchShown = useCallback((saved: SavedSearch) => {
    setAppliedId(saved.id);
    writeRoute(saved);
  }, [writeRoute]);

  // A link that names a saved search: apply it once the list is known, or say it is gone.
  useEffect(() => {
    if (!routeSettled() || viewId === null || appliedId === viewId || !savedSearches) return;
    const saved = savedSearches.find((candidate) => candidate.id === viewId);
    if (!saved) {
      notify(t('savedSearchMissing'));
      writeRoute(null);
      return;
    }
    restoreFilters(saved);
    if (parseDiarySearchParam(searchParams) !== saved.diaryId) writeRoute(saved);
  }, [appliedId, notify, restoreFilters, routeSettled, savedSearches, searchParams, t, viewId, writeRoute]);

  // The filters moved away from the saved search (or it was deleted): the URL stops naming it.
  useEffect(() => {
    if (!routeSettled() || viewId === null || appliedId !== viewId || !savedSearches || shownMatches) return;
    setPendingMeaningSearch(null);
    writeRoute(null);
  }, [appliedId, routeSettled, savedSearches, shownMatches, viewId, writeRoute]);

  // Runs a saved meaning search after the journal has taken its text and diary, which first clears old results.
  const { searchMode, search, onSemanticSearch } = filters;
  useEffect(() => {
    if (!pendingMeaningSearch || searchMode !== 'semantic' || search !== pendingMeaningSearch.search
      || currentDiaryId !== pendingMeaningSearch.diaryId) {
      return undefined;
    }
    const timeoutId = globalThis.setTimeout(() => {
      setPendingMeaningSearch(null);
      void onSemanticSearch();
    }, 0);
    return () => globalThis.clearTimeout(timeoutId);
  }, [currentDiaryId, onSemanticSearch, pendingMeaningSearch, search, searchMode]);

  return { shownSearch: shownMatches ? shown : null, applySavedSearch, markSavedSearchShown };
}

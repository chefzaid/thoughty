import { useEffect, useRef, type ComponentProps } from 'react';

import type FilterControls from '../FilterControls/FilterControls';
import { useLateSearchParams } from '../../hooks/useLateSearchParams';
import { JOURNAL_PERSON_PARAM, parseJournalPersonParam } from '../../utils/appRouting';
import { SAVED_SEARCH_PARAM, personViewFilterState } from '../../utils/savedSearches';

/** The filter bar's setters that opening a person's entries resets, and the person filter itself. */
export type PersonFilterControls = Pick<ComponentProps<typeof FilterControls>,
  | 'filterPersonId' | 'setFilterPersonId' | 'setSearch' | 'setSearchMode' | 'setSearchSort' | 'setFilterTags'
  | 'setFilterDateObj' | 'setFilterVisibility' | 'setFilterFavorites' | 'setFilterArchiveStatus' | 'setFilterMood'
  | 'setFilterEraId'>;

/**
 * Keeps the journal's person filter in its address (`?diary=all&person=12`), the address leading: a
 * mention link, the People page or the back button sets the filter, and choosing or clearing a
 * person in the filter bar writes the address. A person opened from elsewhere shows every entry that
 * mentions them, so the other filters are cleared, unless a saved search in the address restores its own.
 */
export function usePersonFilterRoute(controls: PersonFilterControls): void {
  const [searchParams, writeSearchParams] = useLateSearchParams();
  const routePersonId = parseJournalPersonParam(searchParams);
  const showsSavedSearch = searchParams.has(SAVED_SEARCH_PARAM);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  /** The person the address showed when last read; undefined before the first read. */
  const seenRef = useRef<number | null | undefined>(undefined);
  /** The person this hook wrote to the address, until the address shows it (router updates can land a render later). */
  const writingRef = useRef<number | null | undefined>(undefined);
  /** The address's person and the filter's when this hook last acted on them. */
  const handledRef = useRef<{ readonly route: number | null; readonly filter: number | null } | null>(null);
  const { filterPersonId } = controls;

  useEffect(() => {
    // React can run this again on the same values (Strict Mode's check, or another part of the address
    // changing). They were handled: acting again would read the person just given to the filter, which
    // it does not show yet, as the writer clearing it, and drop them from the address.
    const handled = handledRef.current;
    if (handled?.route === routePersonId && handled.filter === filterPersonId) return;
    handledRef.current = { route: routePersonId, filter: filterPersonId };

    if (writingRef.current !== undefined) {
      if (routePersonId !== writingRef.current) return;
      writingRef.current = undefined;
      seenRef.current = routePersonId;
    }

    if (routePersonId !== seenRef.current) {
      seenRef.current = routePersonId;
      if (routePersonId === filterPersonId) return;
      const current = controlsRef.current;
      if (routePersonId !== null && !showsSavedSearch) {
        // Archived entries mention the person too
        const view = personViewFilterState(routePersonId);
        current.setSearch(view.search);
        current.setSearchMode(view.searchMode);
        current.setSearchSort(view.searchSort);
        current.setFilterTags(view.filterTags);
        current.setFilterDateObj(view.filterDateObj);
        current.setFilterVisibility(view.filterVisibility);
        current.setFilterFavorites(view.filterFavorites);
        current.setFilterArchiveStatus(view.filterArchiveStatus);
        current.setFilterMood(view.filterMood);
        current.setFilterEraId(view.filterEraId);
      }
      current.setFilterPersonId(routePersonId);
      return;
    }

    if (filterPersonId === routePersonId) return;
    const written = writeSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (filterPersonId === null) {
        next.delete(JOURNAL_PERSON_PARAM);
      } else {
        next.set(JOURNAL_PERSON_PARAM, String(filterPersonId));
      }
      return next;
    }, { replace: true });
    if (written) writingRef.current = filterPersonId;
  }, [filterPersonId, routePersonId, showsSavedSearch, writeSearchParams]);
}

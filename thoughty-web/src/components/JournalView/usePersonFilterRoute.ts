import { useEffect, useRef, type ComponentProps } from 'react';
import { useSearchParams } from 'react-router-dom';

import type FilterControls from '../FilterControls/FilterControls';
import { JOURNAL_PERSON_PARAM, parseJournalPersonParam } from '../../utils/appRouting';
import { SAVED_SEARCH_PARAM } from '../../utils/savedSearches';

/** The filter bar's setters that opening a person's entries resets, and the person filter itself. */
export type PersonFilterControls = Pick<ComponentProps<typeof FilterControls>,
  | 'filterPersonId' | 'setFilterPersonId' | 'setSearch' | 'setSearchMode' | 'setSearchSort' | 'setFilterTags'
  | 'setFilterDateObj' | 'setFilterVisibility' | 'setFilterFavorites' | 'setFilterArchiveStatus' | 'setFilterMood'
  | 'setFilterEraId' | 'setPage'>;

/**
 * Keeps the journal's person filter in its address (`?diary=all&person=12`), the address leading: a
 * mention link, the People page or the back button sets the filter, and choosing or clearing a
 * person in the filter bar writes the address. A person opened from elsewhere shows every entry that
 * mentions them, so the other filters are cleared, unless a saved search in the address restores its own.
 */
export function usePersonFilterRoute(controls: PersonFilterControls): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const routePersonId = parseJournalPersonParam(searchParams);
  const showsSavedSearch = searchParams.has(SAVED_SEARCH_PARAM);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  /** The person the address showed when last read; undefined before the first read. */
  const seenRef = useRef<number | null | undefined>(undefined);
  /** The person this hook wrote to the address, until the address shows it (router updates can land a render later). */
  const writingRef = useRef<number | null | undefined>(undefined);
  const { filterPersonId } = controls;

  useEffect(() => {
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
        current.setSearch('');
        current.setSearchMode('keyword');
        current.setSearchSort('relevance');
        current.setFilterTags([]);
        current.setFilterDateObj(null);
        current.setFilterVisibility('all');
        current.setFilterFavorites(false);
        // Archived entries mention the person too
        current.setFilterArchiveStatus('all');
        current.setFilterMood('');
        current.setFilterEraId(null);
      }
      current.setFilterPersonId(routePersonId);
      current.setPage(1);
      return;
    }

    if (filterPersonId !== routePersonId) {
      writingRef.current = filterPersonId;
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (filterPersonId === null) {
          next.delete(JOURNAL_PERSON_PARAM);
        } else {
          next.set(JOURNAL_PERSON_PARAM, String(filterPersonId));
        }
        return next;
      }, { replace: true });
    }
  }, [filterPersonId, routePersonId, setSearchParams, showsSavedSearch]);
}

import type { ArchiveStatusFilter, Diary, EntrySearchSort, TranslationFunction } from '../types';
import type { EntrySearchMode } from '../hooks/useEntriesState';
import type { SavedSearchFilters } from '../services/api/savedSearchesService';
import { formatEntryDate } from './entryDate';
import { MOOD_FILTER_OPTIONS, isMoodFilter, type MoodFilter } from './entryMood';

/** The journal URL parameter that names the saved search being shown. */
export const SAVED_SEARCH_PARAM = 'view';

/** The filter bar's state, as the journal holds it. */
export interface JournalFilterState {
  readonly search: string;
  readonly searchMode: EntrySearchMode;
  readonly searchSort: EntrySearchSort;
  readonly filterTags: string[];
  readonly filterDateObj: Date | null;
  readonly filterVisibility: 'all' | 'public' | 'private';
  readonly filterFavorites: boolean;
  readonly filterArchiveStatus: ArchiveStatusFilter;
  readonly filterMood: MoodFilter;
}

export function toSavedSearchFilters(state: JournalFilterState): SavedSearchFilters {
  return {
    search: state.search,
    searchMode: state.searchMode,
    sort: state.searchSort,
    tags: [...state.filterTags],
    date: state.filterDateObj ? formatEntryDate(state.filterDateObj) : null,
    visibility: state.filterVisibility,
    archiveStatus: state.filterArchiveStatus,
    favorites: state.filterFavorites,
    mood: state.filterMood,
  };
}

/** The local-time day of a `YYYY-MM-DD` date, as the date picker holds it. */
export function parseSavedSearchDate(date: string | null): Date | null {
  const match = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** The saved mood filter when the filter bar offers it, else any mood. */
export function savedSearchMood(mood: string): MoodFilter {
  return isMoodFilter(mood) ? mood : '';
}

/** Whether the filter bar shows exactly what a saved search holds (tags in any order). */
export function matchesSavedSearch(filters: SavedSearchFilters, state: JournalFilterState): boolean {
  const current = toSavedSearchFilters(state);
  const sortedTags = (tags: readonly string[]) => [...tags].sort().join('\n');
  return current.search === filters.search
    && current.searchMode === filters.searchMode
    && current.sort === filters.sort
    && sortedTags(current.tags) === sortedTags(filters.tags)
    && current.date === filters.date
    && current.visibility === filters.visibility
    && current.archiveStatus === filters.archiveStatus
    && current.favorites === filters.favorites
    && current.mood === savedSearchMood(filters.mood);
}

/** A short line naming the diary scope and every filter a saved search sets, in the reader's language. */
export function describeSavedSearch(
  filters: SavedSearchFilters,
  diaryId: number | null,
  diaries: readonly Pick<Diary, 'id' | 'name'>[],
  t: TranslationFunction,
): string {
  const diaryName = diaryId === null ? t('allDiaries') : diaries.find((diary) => diary.id === diaryId)?.name;
  const search = filters.search.trim();
  const mood = MOOD_FILTER_OPTIONS.find((option) => option.value === savedSearchMood(filters.mood));
  const archive: Record<SavedSearchFilters['archiveStatus'], string | null> = {
    active: null,
    archived: t('archived'),
    all: t('savedSearchActiveAndArchived'),
  };
  const filterParts = [
    search ? t(filters.searchMode === 'semantic' ? 'savedSearchMeaning' : 'savedSearchText', { search }) : null,
    filters.tags.length > 0 ? filters.tags.join(', ') : null,
    filters.date,
    filters.visibility === 'all' ? null : t(filters.visibility),
    archive[filters.archiveStatus],
    filters.favorites ? t('favorites') : null,
    mood && mood.value ? t(mood.labelKey) : null,
  ].filter((part): part is string => Boolean(part));

  return [diaryName, ...(filterParts.length > 0 ? filterParts : [t('savedSearchNoFilters')])]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

import type { ArchiveStatusFilter, Diary, EntrySearchSort, TranslationFunction } from '../types';
import type { EntrySearchMode } from '../hooks/useEntriesState';
import type { SavedSearchFilters } from '../services/api/savedSearchesService';
import { formatEntryDate } from './entryDate';
import { MOOD_FILTER_OPTIONS, isMoodFilter, type MoodFilter } from './entryMood';
import type { LifeEra } from '../services/api/lifeErasService';
import { eraLabel } from './lifeEras';
import type { Person } from '../services/api/peopleService';

/** The longest saved search name the API takes. */
export const SAVED_SEARCH_NAME_MAX_LENGTH = 80;

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
  /** The life era the entries are dated in; null for any date. */
  readonly filterEraId: number | null;
  /** The person the entries mention; null for anyone. */
  readonly filterPersonId: number | null;
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
    eraId: state.filterEraId,
    personId: state.filterPersonId,
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
    && current.mood === savedSearchMood(filters.mood)
    // Searches saved before life eras or people have none
    && current.eraId === (filters.eraId ?? null)
    && current.personId === (filters.personId ?? null);
}

/**
 * The filter bar as a person's view shows it: every entry that mentions them, archived ones too, with
 * no other filter (what opening a person from a mention or the People page sets).
 */
export function personViewFilterState(personId: number): JournalFilterState {
  return {
    search: '',
    searchMode: 'keyword',
    searchSort: 'relevance',
    filterTags: [],
    filterDateObj: null,
    filterVisibility: 'all',
    filterFavorites: false,
    filterArchiveStatus: 'all',
    filterMood: '',
    filterEraId: null,
    filterPersonId: personId,
  };
}

/** The writer's saved search of exactly a person's view, across all diaries, if they have one. */
export function findPersonViewSearch<T extends { diaryId: number | null; filters: SavedSearchFilters }>(
  searches: readonly T[],
  personId: number,
): T | undefined {
  const state = personViewFilterState(personId);
  return searches.find((saved) => saved.diaryId === null && matchesSavedSearch(saved.filters, state));
}

/** A short line naming the diary scope and every filter a saved search sets, in the reader's language. */
export function describeSavedSearch(
  filters: SavedSearchFilters,
  diaryId: number | null,
  diaries: readonly Pick<Diary, 'id' | 'name'>[],
  t: TranslationFunction,
  eras: readonly Pick<LifeEra, 'id' | 'name' | 'emoji'>[] = [],
  people: readonly Pick<Person, 'id' | 'name'>[] = [],
): string {
  const diaryName = diaryId === null ? t('allDiaries') : diaries.find((diary) => diary.id === diaryId)?.name;
  const search = filters.search.trim();
  const mood = MOOD_FILTER_OPTIONS.find((option) => option.value === savedSearchMood(filters.mood));
  const era = filters.eraId ? eras.find((candidate) => candidate.id === filters.eraId) : undefined;
  const person = filters.personId ? people.find((candidate) => candidate.id === filters.personId) : undefined;
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
    era ? eraLabel(era) : null,
    person ? t('savedSearchPerson', { name: person.name }) : null,
  ].filter((part): part is string => Boolean(part));

  return [diaryName, ...(filterParts.length > 0 ? filterParts : [t('savedSearchNoFilters')])]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

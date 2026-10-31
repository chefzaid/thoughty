import { useState, type Dispatch, type SetStateAction } from 'react';
import { vi } from 'vitest';

import { useEntryNavigation } from './useEntryNavigation';
import type { MoodFilter } from '../utils/entryMood';

export type UseEntryNavigationParams = Omit<
  Parameters<typeof useEntryNavigation>[0],
  'handledPermalinkEntryId' | 'setHandledPermalinkEntryId'
>;

/** Keeps the landed permalink in state, as useEntries does for the app shell. */
export function useNavigation(params: UseEntryNavigationParams) {
  const [handledPermalinkEntryId, setHandledPermalinkEntryId] = useState<number | null>(null);
  return useEntryNavigation({ ...params, handledPermalinkEntryId, setHandledPermalinkEntryId });
}

export function createSetterSpy<T>() {
  return vi.fn() as unknown as Dispatch<SetStateAction<T>>;
}

export function createParams(overrides: Partial<UseEntryNavigationParams> = {}): UseEntryNavigationParams {
  return {
    configLoaded: true,
    currentDiaryId: null,
    currentView: 'journal',
    entries: [],
    entriesService: {
      navigateByDate: vi.fn().mockResolvedValue({ found: true, page: 1, entryId: 2 }),
      navigateById: vi.fn().mockResolvedValue({ found: true, page: 1, entryId: 2 }),
    } as unknown as UseEntryNavigationParams['entriesService'],
    filterArchiveStatus: 'all',
    filterDateObj: null,
    filterFavorites: false,
    filterMood: '',
    filterEraId: null,
    filterPersonId: null,
    filterTags: [],
    filterVisibility: 'all',
    getLimit: vi.fn(() => 10),
    isAuthenticated: true,
    loading: false,
    navigate: vi.fn(),
    page: 1,
    routeEntryId: undefined,
    search: '',
    searchParams: new URLSearchParams('diary=all'),
    setActiveTargetId: vi.fn(),
    setCurrentDiaryId: createSetterSpy<number | null>(),
    setFilterArchiveStatus: createSetterSpy<'all' | 'active' | 'archived'>(),
    setFilterDateObj: createSetterSpy<Date | null>(),
    setFilterFavorites: createSetterSpy<boolean>(),
    setFilterMood: createSetterSpy<MoodFilter>(),
    setFilterEraId: createSetterSpy<number | null>(),
    setFilterPersonId: createSetterSpy<number | null>(),
    setFilterTags: createSetterSpy<string[]>(),
    setFilterVisibility: createSetterSpy<'all' | 'public' | 'private'>(),
    setPage: createSetterSpy<number>(),
    setSearch: createSetterSpy<string>(),
    setSourceEntry: vi.fn(),
    setTargetEntryId: vi.fn(),
    sourceEntry: null,
    t: (key: string) => key,
    ...overrides,
  };
}

import { useState, type Dispatch, type SetStateAction } from 'react';
import { vi } from 'vitest';

import { useEntryNavigation } from './useEntryNavigation';
import type { MoodFilter } from '../utils/entryMood';

export type UseEntryNavigationParams = Omit<
  Parameters<typeof useEntryNavigation>[0],
  'handledPermalinkEntryId' | 'setHandledPermalinkEntryId' | 'filtersResetting' | 'setFiltersResetting'
> & { setFiltersResetting?: (resetting: boolean) => void };

/** Keeps the landed permalink and the reset in progress in state, as useEntries does for the app shell. */
export function useNavigation({ setFiltersResetting: onResetting, ...params }: UseEntryNavigationParams) {
  const [handledPermalinkEntryId, setHandledPermalinkEntryId] = useState<number | null>(null);
  const [filtersResetting, setFiltersResetting] = useState(false);
  return useEntryNavigation({
    ...params,
    handledPermalinkEntryId,
    setHandledPermalinkEntryId,
    filtersResetting,
    setFiltersResetting: (resetting: SetStateAction<boolean>) => {
      onResetting?.(resetting as boolean);
      setFiltersResetting(resetting);
    },
  });
}

export function createSetterSpy<T>() {
  return vi.fn() as unknown as Dispatch<SetStateAction<T>>;
}

export function createParams(overrides: Partial<UseEntryNavigationParams> = {}): UseEntryNavigationParams {
  return {
    currentDiaryId: null,
    currentView: 'journal',
    entriesService: {
      navigateByDate: vi.fn().mockResolvedValue({ found: true, entryId: 2 }),
    } as unknown as UseEntryNavigationParams['entriesService'],
    filterArchiveStatus: 'all',
    filterDateObj: null,
    filterFavorites: false,
    filterMood: '',
    filterEraId: null,
    filterPersonId: null,
    filterTags: [],
    filterVisibility: 'all',
    entryToast: { visible: false, showCount: 0, show: vi.fn(), hide: vi.fn() },
    isAuthenticated: true,
    navigate: vi.fn(),
    openListAt: vi.fn(),
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
    setSearch: createSetterSpy<string>(),
    setSourceEntry: vi.fn(),
    setTargetEntryId: vi.fn(),
    sourceEntry: null,
    t: (key: string) => key,
    ...overrides,
  };
}

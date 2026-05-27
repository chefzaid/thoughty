import type { Dispatch, SetStateAction } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEntryNavigation } from './useEntryNavigation';

type UseEntryNavigationParams = Parameters<typeof useEntryNavigation>[0];

function createSetterSpy<T>() {
  return vi.fn() as unknown as Dispatch<SetStateAction<T>>;
}

function createParams(overrides: Partial<UseEntryNavigationParams> = {}): UseEntryNavigationParams {
  return {
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

describe('useEntryNavigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies the entry permalink when native share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const { result } = renderHook(() => useEntryNavigation(createParams()));

    let shareResult = false;
    await act(async () => {
      shareResult = await result.current.handleShareEntry({
        id: 7,
        content: 'Entry',
        tags: [],
        date: '2024-01-15',
        visibility: 'private',
      });
    });

    expect(shareResult).toBe(true);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/journal?entry=7'));
  });

  it('loads a permalink target from route state', async () => {
    const navigateById = vi.fn().mockResolvedValue({ found: true, page: 2, entryId: 9 });
    const setPage = createSetterSpy<number>();
    const setTargetEntryId = vi.fn();
    const setActiveTargetId = vi.fn();
    const params = createParams({
      entriesService: {
        navigateByDate: vi.fn(),
        navigateById,
      } as unknown as UseEntryNavigationParams['entriesService'],
      routeEntryId: 7,
      searchParams: new URLSearchParams('entry=7&diary=all'),
      setPage,
      setTargetEntryId,
      setActiveTargetId,
    });

    renderHook(() => useEntryNavigation(params));

    await waitFor(() => {
      expect(navigateById).toHaveBeenCalledWith(7, 10);
    });

    expect(setPage).toHaveBeenCalledWith(2);
    expect(setTargetEntryId).toHaveBeenCalledWith(9);
    expect(setActiveTargetId).toHaveBeenCalledWith(9);
  });

  it('clears active permalinks before navigating to a cross-reference target', async () => {
    const navigate = vi.fn();
    const navigateByDate = vi.fn().mockResolvedValue({ found: true, page: 3, entryId: 11 });
    const setSourceEntry = vi.fn();
    const setPage = createSetterSpy<number>();
    const setTargetEntryId = vi.fn();
    const setActiveTargetId = vi.fn();
    const params = createParams({
      entriesService: {
        navigateByDate,
        navigateById: vi.fn(),
      } as unknown as UseEntryNavigationParams['entriesService'],
      navigate,
      searchParams: new URLSearchParams('entry=2&diary=all'),
      setSourceEntry,
      setPage,
      setTargetEntryId,
      setActiveTargetId,
    });
    const { result } = renderHook(() => useEntryNavigation(params));

    await act(async () => {
      await result.current.handleNavigateToEntry('2024-01-16', 1, {
        id: 5,
        date: '2024-01-14',
        index: 1,
      }, true);
    });

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/journal',
      search: '?diary=all',
    }, { replace: true });
    expect(setSourceEntry).toHaveBeenCalledWith({ id: 5, date: '2024-01-14', index: 1 });
    expect(navigateByDate).toHaveBeenCalledWith('2024-01-16', 1, 10);
    expect(setPage).toHaveBeenCalledWith(3);
    expect(setTargetEntryId).toHaveBeenCalledWith(11);
    expect(setActiveTargetId).toHaveBeenCalledWith(11);
  });

  it('shows toast state when a permalink target cannot be resolved', async () => {
    const navigateById = vi.fn().mockResolvedValue({ found: false });
    const setSourceEntry = vi.fn();
    const setActiveTargetId = vi.fn();
    const params = createParams({
      entriesService: {
        navigateByDate: vi.fn(),
        navigateById,
      } as unknown as UseEntryNavigationParams['entriesService'],
      routeEntryId: 77,
      searchParams: new URLSearchParams('entry=77&diary=all'),
      setSourceEntry,
      setActiveTargetId,
    });
    const { result } = renderHook(() => useEntryNavigation(params));

    await waitFor(() => {
      expect(result.current.entryToastVisible).toBe(true);
    });

    expect(navigateById).toHaveBeenCalledWith(77, 10);
    expect(setSourceEntry).toHaveBeenCalledWith(null);
    expect(setActiveTargetId).toHaveBeenCalledWith(null);
  });
});
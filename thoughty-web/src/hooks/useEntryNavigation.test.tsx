import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MoodFilter } from '../utils/entryMood';
import { createParams, createSetterSpy, useNavigation, type UseEntryNavigationParams } from './useEntryNavigation.test-helpers';

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

    const { result } = renderHook(() => useNavigation(createParams()));

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

  it('uses the native share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'share', { value: share, configurable: true });

    const { result } = renderHook(() => useNavigation(createParams()));

    await expect(result.current.handleShareEntry({
      id: 4,
      content: 'Entry',
      tags: [],
      date: '2024-01-15',
      visibility: 'private',
    })).resolves.toBe(true);

    expect(share).toHaveBeenCalledWith({
      title: 'shareEntry',
      url: expect.stringContaining('/journal?entry=4'),
    });
  });

  it('shares a titled entry under its title', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'share', { value: share, configurable: true });

    const { result } = renderHook(() => useNavigation(createParams()));

    await result.current.handleShareEntry({
      id: 5,
      title: 'Harbor at dawn',
      content: 'Entry',
      tags: [],
      date: '2024-01-15',
      visibility: 'private',
    });

    expect(share).toHaveBeenCalledWith({
      title: 'Harbor at dawn',
      text: 'Harbor at dawn',
      url: expect.stringContaining('/journal?entry=5'),
    });
  });

  it('returns false when native share is aborted or clipboard sharing is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'share', {
      value: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
      configurable: true,
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });

    const { result, rerender } = renderHook((params: UseEntryNavigationParams) => useNavigation(params), {
      initialProps: createParams(),
    });

    await expect(result.current.handleShareEntry({
      id: 5,
      content: 'Entry',
      tags: [],
      date: '2024-01-15',
      visibility: 'private',
    })).resolves.toBe(false);

    Object.defineProperty(globalThis.navigator, 'share', { value: undefined, configurable: true });
    rerender(createParams());

    await expect(result.current.handleShareEntry({
      id: 6,
      content: 'Entry',
      tags: [],
      date: '2024-01-15',
      visibility: 'private',
    })).resolves.toBe(false);
  });

  it('returns false when clipboard sharing throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(globalThis.navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard failed')) },
      configurable: true,
    });

    const { result } = renderHook(() => useNavigation(createParams()));

    await expect(result.current.handleShareEntry({
      id: 8,
      content: 'Entry',
      tags: [],
      date: '2024-01-15',
      visibility: 'private',
    })).resolves.toBe(false);

    expect(consoleError).toHaveBeenCalledWith('Error sharing entry:', expect.any(Error));
  });

  it('opens the list around a permalink target from route state, without a lookup', () => {
    const navigateByDate = vi.fn();
    const params = createParams({
      entriesService: { navigateByDate } as unknown as UseEntryNavigationParams['entriesService'],
      routeEntryId: 7,
      searchParams: new URLSearchParams('entry=7&diary=all'),
    });

    const { rerender } = renderHook((props: UseEntryNavigationParams) => useNavigation(props), { initialProps: params });

    expect(params.openListAt).toHaveBeenCalledWith(7);
    expect(params.setTargetEntryId).toHaveBeenCalledWith(7);
    expect(params.setActiveTargetId).toHaveBeenCalledWith(7);
    expect(navigateByDate).not.toHaveBeenCalled();

    // Once landed, the permalink is left alone
    rerender({ ...params, filterArchiveStatus: 'all' });
    expect(params.openListAt).toHaveBeenCalledTimes(1);
  });

  it('resets journal filters for a permalink first, holding the list until they are reset', () => {
    const setFilterArchiveStatus = createSetterSpy<'all' | 'active' | 'archived'>();
    const setFiltersResetting = vi.fn();
    const params = createParams({
      filterArchiveStatus: 'active',
      routeEntryId: 7,
      searchParams: new URLSearchParams('entry=7&diary=all'),
      setFilterArchiveStatus,
      setFiltersResetting,
    });
    const { rerender } = renderHook((props: UseEntryNavigationParams) => useNavigation(props), { initialProps: params });

    expect(setFilterArchiveStatus).toHaveBeenCalledWith('all');
    expect(setFiltersResetting).toHaveBeenCalledWith(true);
    expect(params.openListAt).not.toHaveBeenCalled();

    rerender({ ...params, filterArchiveStatus: 'all' });
    expect(setFiltersResetting).toHaveBeenLastCalledWith(false);
    expect(params.openListAt).toHaveBeenCalledWith(7);
  });

  it('clears active permalinks before navigating to a cross-reference target', async () => {
    const navigate = vi.fn();
    const navigateByDate = vi.fn().mockResolvedValue({ found: true, entryId: 11 });
    const setSourceEntry = vi.fn();
    const params = createParams({
      entriesService: { navigateByDate } as unknown as UseEntryNavigationParams['entriesService'],
      navigate,
      searchParams: new URLSearchParams('entry=2&diary=all'),
      setSourceEntry,
    });
    const { result } = renderHook(() => useNavigation(params));

    await act(async () => {
      await result.current.handleNavigateToEntry('2024-01-16', 1, {
        id: 5,
        date: '2024-01-14',
        index: 1,
      });
    });

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/journal',
      search: '?diary=all',
    }, { replace: true });
    expect(setSourceEntry).toHaveBeenCalledWith({ id: 5, date: '2024-01-14', index: 1 });
    expect(navigateByDate).toHaveBeenCalledWith('2024-01-16', 1);
    expect(params.openListAt).toHaveBeenCalledWith(11);
    expect(params.setTargetEntryId).toHaveBeenCalledWith(11);
    expect(params.setActiveTargetId).toHaveBeenCalledWith(11);
  });

  it('shows the toast when a cross-reference names no entry', async () => {
    const show = vi.fn();
    const params = createParams({
      entriesService: { navigateByDate: vi.fn().mockResolvedValue({ found: false }) } as unknown as UseEntryNavigationParams['entriesService'],
      entryToast: { visible: false, showCount: 0, show, hide: vi.fn() },
    });
    const { result } = renderHook(() => useNavigation(params));

    await act(async () => {
      await result.current.handleNavigateToEntry('2024-01-16', 3);
    });

    expect(show).toHaveBeenCalledTimes(1);
    expect(params.setSourceEntry).toHaveBeenCalledWith(null);
    expect(params.setActiveTargetId).toHaveBeenCalledWith(null);
    expect(params.openListAt).not.toHaveBeenCalled();
  });

  it('returns early for unauthenticated permalink access', () => {
    const params = createParams({
      isAuthenticated: false,
      routeEntryId: 44,
      searchParams: new URLSearchParams('entry=44&diary=all'),
    });

    renderHook(() => useNavigation(params));

    expect(params.openListAt).not.toHaveBeenCalled();
  });

  it('resets journal filters before navigating to an entry target', async () => {
    const navigate = vi.fn();
    const setSearch = createSetterSpy<string>();
    const setFilterTags = createSetterSpy<string[]>();
    const setFilterDateObj = createSetterSpy<Date | null>();
    const setFilterVisibility = createSetterSpy<'all' | 'public' | 'private'>();
    const setFilterFavorites = createSetterSpy<boolean>();
    const setFilterArchiveStatus = createSetterSpy<'all' | 'active' | 'archived'>();
    const setFilterMood = createSetterSpy<MoodFilter>();
    const setFilterEraId = createSetterSpy<number | null>();
    const setFilterPersonId = createSetterSpy<number | null>();
    const setCurrentDiaryId = createSetterSpy<number | null>();
    const navigateByDate = vi.fn().mockResolvedValue({ found: true, entryId: 13 });
    const params = createParams({
      currentDiaryId: 9,
      entriesService: { navigateByDate } as unknown as UseEntryNavigationParams['entriesService'],
      filterArchiveStatus: 'active',
      filterDateObj: new Date('2024-01-15'),
      filterFavorites: true,
      filterMood: '4,5',
      filterEraId: 3,
      filterPersonId: 12,
      filterTags: ['work'],
      filterVisibility: 'private',
      navigate,
      search: 'focus',
      searchParams: new URLSearchParams('diary=9'),
      setCurrentDiaryId,
      setFilterArchiveStatus,
      setFilterDateObj,
      setFilterFavorites,
      setFilterMood,
      setFilterEraId,
      setFilterPersonId,
      setFilterTags,
      setFilterVisibility,
      setSearch,
    });
    const { result } = renderHook(() => useNavigation(params));

    await act(async () => {
      await result.current.handleNavigateToEntry('2024-02-01', 2, null);
    });

    expect(setSearch).toHaveBeenCalledWith('');
    expect(setFilterTags).toHaveBeenCalledWith([]);
    expect(setFilterDateObj).toHaveBeenCalledWith(null);
    expect(setFilterVisibility).toHaveBeenCalledWith('all');
    expect(setFilterFavorites).toHaveBeenCalledWith(false);
    expect(setFilterArchiveStatus).toHaveBeenCalledWith('all');
    expect(setFilterMood).toHaveBeenCalledWith('');
    expect(setFilterEraId).toHaveBeenCalledWith(null);
    expect(setFilterPersonId).toHaveBeenCalledWith(null);
    expect(setCurrentDiaryId).toHaveBeenCalledWith(null);
    expect(navigate).toHaveBeenCalledWith({ pathname: '/journal', search: '?diary=all' }, { replace: true });
    expect(navigateByDate).toHaveBeenCalledWith('2024-02-01', 2);
    expect(params.openListAt).toHaveBeenCalledWith(13);
  });

  it('opens the list back at the source entry', () => {
    const params = createParams({ sourceEntry: { id: 21, date: '2024-01-10', index: 1 } });
    const { result } = renderHook(() => useNavigation(params));

    act(() => result.current.handleBackToSource());

    expect(params.openListAt).toHaveBeenCalledWith(21);
    expect(params.setTargetEntryId).toHaveBeenCalledWith(21);
    expect(params.setSourceEntry).toHaveBeenCalledWith(null);
    expect(params.setActiveTargetId).toHaveBeenCalledWith(null);
  });

  it('does nothing when there is no source entry to navigate back to', () => {
    const params = createParams({ sourceEntry: null });
    const { result } = renderHook(() => useNavigation(params));

    act(() => result.current.handleBackToSource());

    expect(params.openListAt).not.toHaveBeenCalled();
  });
});

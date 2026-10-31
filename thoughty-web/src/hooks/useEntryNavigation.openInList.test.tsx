import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createParams, createSetterSpy, useNavigation } from './useEntryNavigation.test-helpers';

describe('useEntryNavigation: opening an entry in the filtered list', () => {
  it('moves to the page that shows the entry and highlights it, keeping every filter', () => {
    const setPage = createSetterSpy<number>();
    const setSearch = createSetterSpy<string>();
    const setFilterTags = createSetterSpy<string[]>();
    const setFilterPersonId = createSetterSpy<number | null>();
    const setCurrentDiaryId = createSetterSpy<number | null>();
    const params = createParams({
      currentDiaryId: 2,
      search: 'harbor',
      filterTags: ['walks'],
      filterPersonId: 5,
      page: 1,
      searchParams: new URLSearchParams('diary=2'),
      setPage,
      setSearch,
      setFilterTags,
      setFilterPersonId,
      setCurrentDiaryId,
    });
    const { result } = renderHook(() => useNavigation(params));

    act(() => result.current.handleOpenEntryInList(42, 4));

    expect(setPage).toHaveBeenCalledWith(4);
    expect(params.setTargetEntryId).toHaveBeenCalledWith(42);
    expect(params.setActiveTargetId).toHaveBeenCalledWith(null);
    expect(setSearch).not.toHaveBeenCalled();
    expect(setFilterTags).not.toHaveBeenCalled();
    expect(setFilterPersonId).not.toHaveBeenCalled();
    expect(setCurrentDiaryId).not.toHaveBeenCalled();
    expect(params.navigate).not.toHaveBeenCalled();
    expect(params.entriesService.navigateById).not.toHaveBeenCalled();
  });

  it('drops an entry link the journal was opened with, so the address does not name another entry', () => {
    const navigate = vi.fn();
    const params = createParams({ navigate, searchParams: new URLSearchParams('diary=all&entry=9') });
    const { result } = renderHook(() => useNavigation(params));

    act(() => result.current.handleOpenEntryInList(42, 1));

    expect(navigate).toHaveBeenCalledWith({ pathname: '/journal', search: '?diary=all' }, { replace: true });
    expect(params.setTargetEntryId).toHaveBeenCalledWith(42);
  });
});

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAppShellRouting } from './useAppShellRouting';

type UseAppShellRoutingParams = Parameters<typeof useAppShellRouting>[0];

function createParams(
  overrides: Partial<UseAppShellRoutingParams> = {},
): UseAppShellRoutingParams {
  return {
    currentDiaryId: 7,
    currentView: 'journal',
    diaryReturnView: 'stats',
    fetchConfig: vi.fn(),
    fetchDiaries: vi.fn(),
    fetchEntryDates: vi.fn(),
    fetchProfileStats: vi.fn(),
    importExportFormat: 'txt',
    importExportIncludeVisibility: false,
    importExportSection: 'export',
    logout: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
    setCurrentDiaryId: vi.fn(),
    ...overrides,
  };
}

describe('useAppShellRouting', () => {
  it('refreshes startup data after auth success', () => {
    const params = createParams();
    const { result } = renderHook(() => useAppShellRouting(params));

    result.current.handleAuthSuccess();

    expect(params.fetchConfig).toHaveBeenCalled();
    expect(params.fetchDiaries).toHaveBeenCalled();
    expect(params.fetchEntryDates).toHaveBeenCalled();
    expect(params.fetchProfileStats).toHaveBeenCalled();
  });

  it('navigates diary-aware routes with the current diary search state', () => {
    const navigate = vi.fn();
    const setCurrentDiaryId = vi.fn();
    const { result } = renderHook(() => useAppShellRouting(createParams({
      currentView: 'importExport',
      importExportFormat: 'json',
      importExportIncludeVisibility: true,
      importExportSection: 'import',
      navigate,
      setCurrentDiaryId,
    })));

    act(() => {
      result.current.handleDiaryChange(null);
    });

    expect(setCurrentDiaryId).toHaveBeenCalledWith(null);
    expect(navigate).toHaveBeenCalledWith({
      pathname: '/import-export',
      search: '?diary=all&section=import&format=json&includeVisibility=true',
    }, { replace: true });
  });

  it('returns to intro after logout', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();
    const { result } = renderHook(() => useAppShellRouting(createParams({ logout, navigate })));

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });
});
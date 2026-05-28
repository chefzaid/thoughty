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

  it('navigates between authenticated and public views', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useAppShellRouting(createParams({
      currentDiaryId: 12,
      navigate,
    })));

    act(() => {
      result.current.handleViewChange('journal');
      result.current.handleViewChange('profile');
      result.current.handlePublicViewChange('register');
    });

    expect(navigate).toHaveBeenNthCalledWith(1, {
      pathname: '/journal',
      search: '?diary=12',
    });
    expect(navigate).toHaveBeenNthCalledWith(2, {
      pathname: '/profile',
      search: '',
    });
    expect(navigate).toHaveBeenNthCalledWith(3, '/register');
  });

  it('updates the diary without navigation when the current view does not support diary search', () => {
    const navigate = vi.fn();
    const setCurrentDiaryId = vi.fn();
    const { result } = renderHook(() => useAppShellRouting(createParams({
      currentView: 'profile',
      navigate,
      setCurrentDiaryId,
    })));

    act(() => {
      result.current.handleDiaryChange(4);
    });

    expect(setCurrentDiaryId).toHaveBeenCalledWith(4);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to diary management and back using the stored diary view state', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useAppShellRouting(createParams({
      currentDiaryId: null,
      diaryReturnView: 'importExport',
      navigate,
    })));

    act(() => {
      result.current.handleManageDiaries('stats');
      result.current.handleBackFromDiaries();
    });

    expect(navigate).toHaveBeenNthCalledWith(1, {
      pathname: '/diaries',
      search: '?from=stats&diary=all',
    });
    expect(navigate).toHaveBeenNthCalledWith(2, {
      pathname: '/import-export',
      search: '?diary=all',
    });
  });

  it('updates import-export route state and omits includeVisibility when false', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useAppShellRouting(createParams({
      currentDiaryId: 3,
      navigate,
    })));

    act(() => {
      result.current.handleImportExportRouteStateChange({
        section: 'export',
        exportFormat: 'md',
        includeVisibility: false,
      });
    });

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/import-export',
      search: '?diary=3&section=export&format=md',
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
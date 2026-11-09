import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { buildDiaryRouteSearchParams, toSearchString } from '../utils/appRouting';
import type { DiaryReturnViewType, ImportExportFormat, ImportExportSection, PublicViewType, ViewType } from '../types';
import {
  formatDiarySearchParam,
  getPathForView,
  getPublicPathForView,
  viewSupportsDiarySearch,
} from '../types';

interface UseAppShellRoutingParams {
  currentDiaryId: number | null;
  currentView: ViewType | null;
  diaryReturnView: DiaryReturnViewType;
  fetchConfig: () => void;
  fetchDiaries: () => void;
  fetchEntryDates: () => void;
  fetchProfileStats: () => void;
  importExportFormat: ImportExportFormat;
  importExportIncludeVisibility: boolean;
  importExportSection: ImportExportSection;
  logout: () => Promise<void>;
  navigate: NavigateFunction;
  /** The current address, so a diary change keeps the journal's list or calendar layout. */
  searchParams?: URLSearchParams;
  setCurrentDiaryId: Dispatch<SetStateAction<number | null>>;
}

export function useAppShellRouting({
  currentDiaryId,
  currentView,
  diaryReturnView,
  fetchConfig,
  fetchDiaries,
  fetchEntryDates,
  fetchProfileStats,
  importExportFormat,
  importExportIncludeVisibility,
  importExportSection,
  logout,
  navigate,
  searchParams,
  setCurrentDiaryId,
}: Readonly<UseAppShellRoutingParams>) {
  const handleAuthSuccess = useCallback(() => {
    fetchConfig();
    fetchDiaries();
    fetchEntryDates();
    fetchProfileStats();
  }, [fetchConfig, fetchDiaries, fetchEntryDates, fetchProfileStats]);

  /** Opens a view in the current diary; `state` goes with the navigation (the journal's composer focus, say). */
  const handleViewChange = useCallback((view: ViewType, state?: unknown) => {
    const nextSearchParams = new URLSearchParams();
    if (viewSupportsDiarySearch(view)) {
      nextSearchParams.set('diary', formatDiarySearchParam(currentDiaryId));
    } else if (view === 'review' && currentDiaryId !== null) {
      // As from the Stats page: the year in review opens on the diary being read (all diaries otherwise)
      nextSearchParams.set('diary', String(currentDiaryId));
    }
    const to = {
      pathname: getPathForView(view),
      search: toSearchString(nextSearchParams),
    };
    if (state === undefined) {
      navigate(to);
    } else {
      navigate(to, { state });
    }
  }, [currentDiaryId, navigate]);

  const handlePublicViewChange = useCallback((view: PublicViewType) => {
    navigate(getPublicPathForView(view));
  }, [navigate]);

  const handleDiaryChange = useCallback((diaryId: number | null) => {
    setCurrentDiaryId(diaryId);

    if (!currentView || !viewSupportsDiarySearch(currentView)) {
      return;
    }

    const nextSearchParams = buildDiaryRouteSearchParams(currentView, diaryId, {
      importExportSection,
      importExportFormat,
      importExportIncludeVisibility,
      journalSearchParams: searchParams,
    });

    navigate({
      pathname: getPathForView(currentView),
      search: toSearchString(nextSearchParams),
    }, { replace: true });
  }, [
    currentView,
    importExportFormat,
    importExportIncludeVisibility,
    importExportSection,
    navigate,
    searchParams,
    setCurrentDiaryId,
  ]);

  const handleManageDiaries = useCallback((fromView: DiaryReturnViewType) => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set('from', fromView);
    nextSearchParams.set('diary', formatDiarySearchParam(currentDiaryId));

    navigate({
      pathname: getPathForView('diaries'),
      search: toSearchString(nextSearchParams),
    });
  }, [currentDiaryId, navigate]);

  const handleBackFromDiaries = useCallback(() => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set('diary', formatDiarySearchParam(currentDiaryId));

    navigate({
      pathname: getPathForView(diaryReturnView),
      search: toSearchString(nextSearchParams),
    });
  }, [currentDiaryId, diaryReturnView, navigate]);

  const handleImportExportRouteStateChange = useCallback((nextState: {
    section: ImportExportSection;
    exportFormat: ImportExportFormat;
    includeVisibility: boolean;
  }) => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set('diary', formatDiarySearchParam(currentDiaryId));
    nextSearchParams.set('section', nextState.section);
    nextSearchParams.set('format', nextState.exportFormat);
    if (nextState.includeVisibility) {
      nextSearchParams.set('includeVisibility', 'true');
    }

    navigate({
      pathname: getPathForView('importExport'),
      search: toSearchString(nextSearchParams),
    }, { replace: true });
  }, [currentDiaryId, navigate]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(getPublicPathForView('intro'), { replace: true });
  }, [logout, navigate]);

  return {
    handleAuthSuccess,
    handleBackFromDiaries,
    handleDiaryChange,
    handleImportExportRouteStateChange,
    handleLogout,
    handleManageDiaries,
    handlePublicViewChange,
    handleViewChange,
  };
}
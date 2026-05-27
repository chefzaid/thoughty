import { useLocation, useSearchParams } from 'react-router-dom';

import {
  getPublicViewForPath,
  getViewForPath,
  parseBooleanSearchParam,
  parseDiaryReturnView,
  parseDiarySearchParam,
  parseEntrySearchParam,
  parseImportExportFormat,
  parseImportExportSection,
  viewSupportsDiarySearch,
} from '../types';

export function useAppRouteState() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentView = getViewForPath(location.pathname);
  const publicView = getPublicViewForPath(location.pathname);
  const routeDiaryId = currentView && viewSupportsDiarySearch(currentView)
    ? parseDiarySearchParam(searchParams)
    : undefined;
  const routeEntryId = currentView === 'journal'
    ? parseEntrySearchParam(searchParams)
    : undefined;

  return {
    location,
    searchParams,
    currentView,
    publicView,
    routeDiaryId,
    routeEntryId,
    diaryReturnView: parseDiaryReturnView(searchParams) ?? 'journal',
    importExportSection: parseImportExportSection(searchParams) ?? 'export',
    importExportFormat: parseImportExportFormat(searchParams) ?? 'txt',
    importExportIncludeVisibility: parseBooleanSearchParam(searchParams, 'includeVisibility') ?? false,
  };
}
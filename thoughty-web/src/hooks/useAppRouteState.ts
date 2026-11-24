import { useLocation, useSearchParams } from 'react-router-dom';

import { parseJournalPersonParam } from '../utils/appRouting';

import {
  getLocalizedPublicPage,
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
  // A localized public page is read in its path's language: English as it is, French under /fr/
  const pageLanguage = getLocalizedPublicPage(location.pathname)?.language ?? null;
  const routeDiaryId = currentView && viewSupportsDiarySearch(currentView)
    ? parseDiarySearchParam(searchParams)
    : undefined;
  const routeEntryId = currentView === 'journal'
    ? parseEntrySearchParam(searchParams)
    : undefined;
  const routePersonId = currentView === 'journal' ? parseJournalPersonParam(searchParams) : undefined;

  return {
    location,
    searchParams,
    currentView,
    publicView,
    pageLanguage,
    routeDiaryId,
    routeEntryId,
    routePersonId,
    diaryReturnView: parseDiaryReturnView(searchParams) ?? 'journal',
    importExportSection: parseImportExportSection(searchParams) ?? 'export',
    importExportFormat: parseImportExportFormat(searchParams) ?? 'txt',
    importExportIncludeVisibility: parseBooleanSearchParam(searchParams, 'includeVisibility') ?? false,
  };
}
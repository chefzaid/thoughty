import type { ImportExportFormat, ImportExportSection, ViewType } from '../types';
import { formatDiarySearchParam, getPathForView, viewSupportsDiarySearch } from '../types';

export const ENTRY_PERMALINK_PARAM = 'entry';

export function buildEntryPermalink(entryId: number): string {
  const url = new URL(getPathForView('journal'), globalThis.location.origin);
  url.searchParams.set(ENTRY_PERMALINK_PARAM, entryId.toString());
  return url.toString();
}

export function toSearchString(searchParams: URLSearchParams): string {
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

export function buildDiaryRouteSearchParams(
  view: ViewType,
  diaryId: number | null,
  options?: {
    importExportSection?: ImportExportSection;
    importExportFormat?: ImportExportFormat;
    importExportIncludeVisibility?: boolean;
  },
): URLSearchParams {
  const nextSearchParams = new URLSearchParams();

  if (viewSupportsDiarySearch(view)) {
    nextSearchParams.set('diary', formatDiarySearchParam(diaryId));
  }

  if (view === 'importExport') {
    nextSearchParams.set('section', options?.importExportSection ?? 'export');
    nextSearchParams.set('format', options?.importExportFormat ?? 'txt');

    if (options?.importExportIncludeVisibility) {
      nextSearchParams.set('includeVisibility', 'true');
    }
  }

  return nextSearchParams;
}
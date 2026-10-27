import type { ImportExportFormat, ImportExportSection, ViewType } from '../types';
import { formatDiarySearchParam, getPathForView, viewSupportsDiarySearch } from '../types';

export const ENTRY_PERMALINK_PARAM = 'entry';
/** `layout=calendar` shows the journal as a month grid instead of the list. */
export const JOURNAL_LAYOUT_PARAM = 'layout';
/** The month the journal calendar shows (`YYYY-MM`). */
export const JOURNAL_MONTH_PARAM = 'month';

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
    /** The current journal address, whose list or calendar layout (and month) the journal keeps. */
    journalSearchParams?: URLSearchParams;
  },
): URLSearchParams {
  const nextSearchParams = new URLSearchParams();

  if (viewSupportsDiarySearch(view)) {
    nextSearchParams.set('diary', formatDiarySearchParam(diaryId));
  }

  if (view === 'journal' && options?.journalSearchParams) {
    for (const param of [JOURNAL_LAYOUT_PARAM, JOURNAL_MONTH_PARAM]) {
      const value = options.journalSearchParams.get(param);
      if (value !== null) nextSearchParams.set(param, value);
    }
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
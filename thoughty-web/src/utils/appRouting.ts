import type { ImportExportFormat, ImportExportSection, ViewType } from '../types';
import { formatDiarySearchParam, getPathForView, viewSupportsDiarySearch } from '../types';

export const ENTRY_PERMALINK_PARAM = 'entry';
/** `layout=calendar` shows the journal as a month grid instead of the list. */
export const JOURNAL_LAYOUT_PARAM = 'layout';
/** The month the journal calendar shows (`YYYY-MM`). */
export const JOURNAL_MONTH_PARAM = 'month';
/** `person=<id>` shows the journal entries that mention the person. */
export const JOURNAL_PERSON_PARAM = 'person';

/** The person a journal address names; null when it names none (or not a valid ID). */
export function parseJournalPersonParam(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get(JOURNAL_PERSON_PARAM);
  return raw && /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;
}

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
    /** The current journal address, whose list or calendar layout (and month) and person the journal keeps. */
    journalSearchParams?: URLSearchParams;
  },
): URLSearchParams {
  const nextSearchParams = new URLSearchParams();

  if (viewSupportsDiarySearch(view)) {
    nextSearchParams.set('diary', formatDiarySearchParam(diaryId));
  }

  if (view === 'journal' && options?.journalSearchParams) {
    for (const param of [JOURNAL_LAYOUT_PARAM, JOURNAL_MONTH_PARAM, JOURNAL_PERSON_PARAM]) {
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
/** The navigation state that opens the book converter on entries picked in the journal. */
export interface BookConverterRouteState {
  readonly bookEntryIds: readonly number[];
}

/** Where the journal's Make a book action goes: the book converter of the current diary, with the picked entries. */
export function buildBookConverterRoute(diaryId: number | null, entryIds: readonly number[]): {
  pathname: string;
  search: string;
  state: BookConverterRouteState;
} {
  return {
    pathname: getPathForView('importExport'),
    search: toSearchString(buildDiaryRouteSearchParams('importExport', diaryId, { importExportSection: 'book' })),
    state: { bookEntryIds: [...entryIds] },
  };
}

/** The entry IDs a navigation brought to the book converter, or none. */
export function readBookConverterEntryIds(state: unknown): number[] {
  const ids = (state as Partial<BookConverterRouteState> | null)?.bookEntryIds;
  return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
}

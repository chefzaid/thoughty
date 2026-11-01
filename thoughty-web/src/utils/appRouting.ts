import type { ImportExportFormat, ImportExportSection, ViewType } from '../types';
import { formatDiarySearchParam, getPathForView, viewSupportsDiarySearch } from '../types';

export const ENTRY_PERMALINK_PARAM = 'entry';
/** `layout=calendar` shows the journal as a month grid instead of the list. */
export const JOURNAL_LAYOUT_PARAM = 'layout';
/** The month the journal calendar shows (`YYYY-MM`). */
export const JOURNAL_MONTH_PARAM = 'month';
/** `read=<id>` shows that entry in the reader (`read=first` its first entry), over the journal. */
export const ENTRY_READER_PARAM = 'read';
/** The filters the reader reads (its query string, `readIn=tags%3Dwalks%26month%3D2026-10`), so a reload reads the same. */
export const ENTRY_READER_SCOPE_PARAM = 'readIn';
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
/**
 * How the book converter opens from elsewhere: on entries picked in the journal (its Make a book
 * action), or on the saved search of a person's entries (the person view's Make a book).
 */
export type BookStart =
  | { readonly kind: 'entries'; readonly entryIds: readonly number[] }
  | { readonly kind: 'person'; readonly name: string; readonly savedSearchId: number; readonly savedSearchName: string };

/** The navigation state that opens the book converter on a book start. */
export interface BookConverterRouteState {
  readonly bookStart: BookStart;
}

/** Where a Make a book action goes: the book converter of the diary (all diaries for null), with what the book starts from. */
export function buildBookConverterRoute(diaryId: number | null, start: BookStart): {
  pathname: string;
  search: string;
  state: BookConverterRouteState;
} {
  return {
    pathname: getPathForView('importExport'),
    search: toSearchString(buildDiaryRouteSearchParams('importExport', diaryId, { importExportSection: 'book' })),
    state: { bookStart: start.kind === 'entries' ? { kind: 'entries', entryIds: [...start.entryIds] } : { ...start } },
  };
}

const isPositiveId = (id: unknown): id is number => Number.isInteger(id) && (id as number) > 0;

/** What a navigation brought the book converter to start from, or null when it brought nothing usable. */
export function readBookConverterStart(state: unknown): BookStart | null {
  const start = (state as Partial<BookConverterRouteState> | null)?.bookStart as Record<string, unknown> | undefined;
  if (start?.kind === 'entries' && Array.isArray(start.entryIds)) {
    const entryIds = start.entryIds.filter(isPositiveId);
    return entryIds.length > 0 ? { kind: 'entries', entryIds } : null;
  }
  if (start?.kind === 'person' && isPositiveId(start.savedSearchId)
    && typeof start.name === 'string' && start.name.trim() !== '' && typeof start.savedSearchName === 'string') {
    return { kind: 'person', name: start.name, savedSearchId: start.savedSearchId, savedSearchName: start.savedSearchName };
  }
  return null;
}

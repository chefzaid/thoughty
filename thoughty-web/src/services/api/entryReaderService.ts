import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';
import type { Entry } from '../../types';
import { calendarQueryParams, type EntryCalendarQuery } from './entryCalendarService';
import { entryListParams, type EntryListQuery } from './entryListQuery';

/** The entry being read, whole, with the entries before and after it (oldest first), its place and the count. */
export type EntryReaderPage = Omit<components['schemas']['EntryReaderResponseDto'], 'entry'> & { entry: Entry };

/** The `GET /api/entries/reader` filters a reading keeps: the journal's, a day, and a month. */
const READER_SCOPE_KEYS = [
  'search', 'ids', 'tags', 'date', 'month', 'visibility', 'favorites', 'archiveStatus', 'mood', 'diaryId', 'eraId', 'personId',
] as const;

/**
 * What a reading reads, as the reader's query string: only the filters it knows, and only those set, so the same
 * filters always give the same scope (and the same address). Anything else in `raw` (a link edited by hand) is dropped.
 */
export function normalizeReaderScope(raw: string | URLSearchParams): string {
  const given = new URLSearchParams(raw);
  const scope = new URLSearchParams();
  for (const key of READER_SCOPE_KEYS) {
    const value = given.get(key);
    if (value?.trim()) scope.set(key, value);
  }
  return scope.toString();
}

/** Reading the journal list as it is filtered now (its day included), whatever its page, size and order. */
export function readerScopeFromList(query: EntryListQuery): string {
  return normalizeReaderScope(entryListParams(query));
}

/** Reading one month of the calendar, under the filters it shows. */
export function readerScopeOfMonth(query: EntryCalendarQuery): string {
  return normalizeReaderScope(calendarQueryParams(query));
}

/** One entry of a reading. Errors are translation keys, or the API's coded reason. */
export const createEntryReaderService = (authFetch: AuthFetchFunction) => ({
  read(scope: string, entryId: number | null): Promise<ServiceResult<EntryReaderPage>> {
    const params = new URLSearchParams(normalizeReaderScope(scope));
    if (entryId) params.set('entryId', String(entryId));
    return requestJson(authFetch(`/api/entries/reader?${params}`), 'readerLoadFailed');
  },
});

export type EntryReaderService = ReturnType<typeof createEntryReaderService>;

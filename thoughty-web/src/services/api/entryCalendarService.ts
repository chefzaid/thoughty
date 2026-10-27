import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';
import type { ArchiveStatusFilter } from '../../types';

export type EntryCalendarMonth = components['schemas']['EntryCalendarResponseDto'];
export type EntryCalendarItem = components['schemas']['EntryCalendarItemDto'];

/** The journal filters a calendar month is read with, as the list sends them. */
export interface EntryCalendarQuery {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly search: string;
  readonly tags: readonly string[];
  readonly visibility: 'all' | 'public' | 'private';
  readonly favorites: boolean;
  readonly archiveStatus: ArchiveStatusFilter;
  /** `any`, `none`, or levels such as `4,5`; empty for every entry. */
  readonly mood: string;
  readonly diaryId: number | null;
  /** The life era the entries are dated in; null for any date. */
  readonly eraId: number | null;
  /** The person the entries mention; null for anyone. */
  readonly personId?: number | null;
  /** A meaning search's matches; null when there is none. */
  readonly entryIds: readonly number[] | null;
}

export function calendarQueryParams(query: EntryCalendarQuery): URLSearchParams {
  const params = new URLSearchParams({ month: query.month });
  if (query.search.trim()) params.set('search', query.search);
  if (query.tags.length > 0) params.set('tags', query.tags.join(','));
  if (query.visibility !== 'all') params.set('visibility', query.visibility);
  if (query.favorites) params.set('favorites', 'true');
  if (query.archiveStatus !== 'all') params.set('archiveStatus', query.archiveStatus);
  if (query.mood) params.set('mood', query.mood);
  if (query.diaryId !== null) params.set('diaryId', String(query.diaryId));
  if (query.eraId !== null) params.set('eraId', String(query.eraId));
  if (query.personId) params.set('personId', String(query.personId));
  // No match at all still narrows the month, to nothing
  if (query.entryIds) params.set('ids', query.entryIds.length > 0 ? query.entryIds.join(',') : '0');
  return params;
}

/** A month of the writer's journal as short entry summaries. Errors are translation keys, or the API's coded reason. */
export const createEntryCalendarService = (authFetch: AuthFetchFunction) => ({
  fetchMonth(query: EntryCalendarQuery): Promise<ServiceResult<EntryCalendarMonth>> {
    return requestJson(authFetch(`/api/entries/calendar?${calendarQueryParams(query)}`), 'calendarLoadFailed');
  },
});

export type EntryCalendarService = ReturnType<typeof createEntryCalendarService>;

import type { ArchiveStatusFilter, EntrySearchSort } from '../../types';

/** The journal list's filters and order, as the entry list holds them. */
export interface EntryListQuery {
  search: string;
  /** Order of keyword search results; sent only with a search. */
  sort?: EntrySearchSort;
  filterTags: string[];
  filterDate: string;
  filterVisibility: string;
  favorites: boolean;
  archiveStatus: ArchiveStatusFilter;
  /** `any`, `none`, or levels such as `4,5`; empty for every entry. */
  mood?: string;
  diaryId: number | null;
  /** Only entries dated within this life era. */
  eraId?: number | null;
  /** Only entries that mention this person. */
  personId?: number | null;
  entryIds?: number[] | null;
}

/**
 * Where a batch of the list starts: after a batch's `nextCursor`, before its `prevCursor`, from its own `prevCursor`
 * (to read it again), around an entry, or (none) at the start.
 */
export type EntryBatchPosition = { after: string } | { before: string } | { from: string } | { around: number } | Record<string, never>;

/** The journal list's query for `GET /api/entries` and the lookups that follow it: each filter that is set. */
export function entryListParams(params: EntryListQuery): URLSearchParams {
  const urlParams = new URLSearchParams({
    search: params.search,
    tags: params.filterTags.join(','),
    date: params.filterDate,
    visibility: params.filterVisibility,
  });
  if (params.search.trim() && params.sort) urlParams.append('sort', params.sort);
  if (params.diaryId) urlParams.append('diaryId', params.diaryId.toString());
  if (params.favorites) urlParams.append('favorites', 'true');
  if (params.archiveStatus !== 'all') urlParams.append('archiveStatus', params.archiveStatus);
  if (params.mood) urlParams.append('mood', params.mood);
  if (params.eraId) urlParams.append('eraId', params.eraId.toString());
  if (params.personId) urlParams.append('personId', params.personId.toString());
  // No meaning-search match at all still narrows the list, to nothing
  if (params.entryIds) urlParams.append('ids', params.entryIds.length > 0 ? params.entryIds.join(',') : '0');
  return urlParams;
}

/** The `GET /api/entries` query for a batch of the journal: the filters, the batch size and where it starts. */
export function entryBatchParams(params: EntryListQuery, limit: number, position: EntryBatchPosition): URLSearchParams {
  const urlParams = entryListParams(params);
  urlParams.set('limit', String(limit));
  for (const [key, value] of Object.entries(position)) {
    urlParams.set(key, String(value));
  }
  return urlParams;
}

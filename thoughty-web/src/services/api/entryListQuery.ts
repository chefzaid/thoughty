import type { ArchiveStatusFilter, EntrySearchSort } from '../../types';

/** The journal list's page and filters, as the entry list holds them. */
export interface EntryListQuery {
  page: number;
  limit: number;
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
  entryIds?: number[] | null;
}

/** The `GET /api/entries` query for a page of the journal: the paging, then each filter that is set. */
export function entryListParams(params: EntryListQuery): URLSearchParams {
  const urlParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
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
  // No meaning-search match at all still narrows the list, to nothing
  if (params.entryIds) urlParams.append('ids', params.entryIds.length > 0 ? params.entryIds.join(',') : '0');
  return urlParams;
}

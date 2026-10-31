import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';
import { entryListParams, type EntryListQuery } from './entryListQuery';

/** The picked entry and the page of the filtered list that shows it. */
export type RandomEntry = components['schemas']['RandomEntryResponseDto'];

/** The `GET /api/entries/random` query: the list's own filters, page size and order, without its page. */
export function randomEntryParams(query: EntryListQuery, excludeId: number | null): URLSearchParams {
  const params = entryListParams(query);
  params.delete('page');
  if (excludeId) params.set('excludeId', String(excludeId));
  return params;
}

/** A random entry among the journal filters. Errors are translation keys, or the API's coded reason. */
export const createRandomEntryService = (authFetch: AuthFetchFunction) => ({
  pick(query: EntryListQuery, excludeId: number | null): Promise<ServiceResult<RandomEntry>> {
    return requestJson(authFetch(`/api/entries/random?${randomEntryParams(query, excludeId)}`), 'randomEntryFailed');
  },
});

export type RandomEntryService = ReturnType<typeof createRandomEntryService>;

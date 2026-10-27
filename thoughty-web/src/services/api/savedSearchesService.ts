import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type SavedSearch = components['schemas']['SavedSearchResponseDto'];
export type SavedSearchFilters = components['schemas']['SavedSearchFiltersDto'];
export type SavedSearchList = components['schemas']['SavedSearchListResponseDto'];
export type SavedSearchDraft = components['schemas']['CreateSavedSearchDto'];
type SavedSearchDeleteResult = components['schemas']['SavedSearchDeleteResponseDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The writer's saved journal searches. Errors are translation keys, or the API's coded reason. */
export const createSavedSearchesService = (authFetch: AuthFetchFunction) => ({
  list(): Promise<ServiceResult<SavedSearchList>> {
    return requestJson(authFetch('/api/saved-searches'), 'savedSearchesLoadFailed');
  },

  create(draft: SavedSearchDraft): Promise<ServiceResult<SavedSearch>> {
    return requestJson(
      authFetch('/api/saved-searches', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(draft) }),
      'savedSearchSaveFailed',
    );
  },

  rename(id: number, name: string): Promise<ServiceResult<SavedSearch>> {
    return requestJson(
      authFetch(`/api/saved-searches/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ name }) }),
      'savedSearchRenameFailed',
    );
  },

  remove(id: number): Promise<ServiceResult<SavedSearchDeleteResult>> {
    return requestJson(authFetch(`/api/saved-searches/${id}`, { method: 'DELETE' }), 'savedSearchDeleteFailed');
  },
});

export type SavedSearchesService = ReturnType<typeof createSavedSearchesService>;

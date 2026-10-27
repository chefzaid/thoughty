import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createSavedSearchesService, type SavedSearchDraft, type ServiceResult } from '../../services/api';

export const SAVED_SEARCHES_QUERY_KEY = ['savedSearches'] as const;

/** The writer's saved searches, and the calls that add, rename and remove them (each reloads the list). */
export function useSavedSearches() {
  const service = useAuthenticatedService(createSavedSearchesService);
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: SAVED_SEARCHES_QUERY_KEY,
    queryFn: async () => {
      const result = await service.list();
      if (!result.data) {
        throw new Error(result.error ?? 'savedSearchesLoadFailed');
      }
      return result.data;
    },
  });

  const run = useCallback(async <T>(request: Promise<ServiceResult<T>>): Promise<ServiceResult<T>> => {
    const result = await request;
    await queryClient.invalidateQueries({ queryKey: SAVED_SEARCHES_QUERY_KEY });
    return result;
  }, [queryClient]);

  return {
    list,
    create: useCallback((draft: SavedSearchDraft) => run(service.create(draft)), [run, service]),
    rename: useCallback((id: number, name: string) => run(service.rename(id, name)), [run, service]),
    remove: useCallback((id: number) => run(service.remove(id)), [run, service]),
  };
}

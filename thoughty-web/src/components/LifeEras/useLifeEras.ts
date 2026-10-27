import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { JOURNAL_ENTRY_QUERY_KEYS } from '../../hooks/useEntriesState';
import {
  createLifeErasService,
  type LifeEra,
  type LifeEraChanges,
  type LifeEraDraft,
  type ServiceResult,
} from '../../services/api';
import { SAVED_SEARCHES_QUERY_KEY } from '../SavedSearches/useSavedSearches';

export const LIFE_ERAS_QUERY_KEY = ['lifeEras'] as const;
const NO_ERAS: readonly LifeEra[] = [];

/** The writer's life eras, loaded once for every screen that uses them. */
export function useLifeEraList(enabled = true) {
  const service = useAuthenticatedService(createLifeErasService);
  const list = useQuery({
    queryKey: LIFE_ERAS_QUERY_KEY,
    queryFn: async () => {
      const result = await service.list();
      if (!result.data) {
        throw new Error(result.error ?? 'lifeErasLoadFailed');
      }
      return result.data;
    },
    enabled,
  });
  return { list, eras: list.data?.lifeEras ?? NO_ERAS };
}

/**
 * The life eras with the calls that add, change and remove them. Each reloads the eras, the journal
 * (an era's dates decide which entries it filters) and the saved searches (deleting an era widens them).
 */
export function useLifeEras() {
  const service = useAuthenticatedService(createLifeErasService);
  const queryClient = useQueryClient();
  const { list, eras } = useLifeEraList();

  const run = useCallback(async <T>(request: Promise<ServiceResult<T>>, affectsEntries: boolean): Promise<ServiceResult<T>> => {
    const result = await request;
    const keys = affectsEntries && result.data
      ? [LIFE_ERAS_QUERY_KEY, SAVED_SEARCHES_QUERY_KEY, ...JOURNAL_ENTRY_QUERY_KEYS]
      : [LIFE_ERAS_QUERY_KEY];
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    return result;
  }, [queryClient]);

  return {
    list,
    eras,
    create: useCallback((draft: LifeEraDraft) => run(service.create(draft), false), [run, service]),
    update: useCallback((id: number, changes: LifeEraChanges) => run(service.update(id, changes), true), [run, service]),
    remove: useCallback((id: number) => run(service.remove(id), true), [run, service]),
  };
}

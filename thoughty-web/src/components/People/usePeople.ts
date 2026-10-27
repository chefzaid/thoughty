import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { JOURNAL_ENTRY_QUERY_KEYS } from '../../hooks/useEntriesState';
import { createPeopleService, type Person, type ServiceResult } from '../../services/api';
import { PEOPLE_QUERY_KEY } from '../../utils/mentions';
import { SAVED_SEARCHES_QUERY_KEY } from '../SavedSearches/useSavedSearches';

const NO_PEOPLE: readonly Person[] = [];

/** The people the writer mentions, loaded once for every screen that uses them. */
export function usePeopleList(enabled = true) {
  const service = useAuthenticatedService(createPeopleService);
  const list = useQuery({
    queryKey: PEOPLE_QUERY_KEY,
    queryFn: async () => {
      const result = await service.list();
      if (!result.data) {
        throw new Error(result.error ?? 'peopleLoadFailed');
      }
      return result.data;
    },
    enabled,
  });
  return { list, people: list.data?.people ?? NO_PEOPLE };
}

/**
 * The people with the calls that rename, merge and delete them. Merging and deleting also reload the
 * journal (a person's entries change) and the saved searches (they follow the person kept, or widen).
 */
export function usePeople() {
  const service = useAuthenticatedService(createPeopleService);
  const queryClient = useQueryClient();
  const { list, people } = usePeopleList();

  const run = useCallback(async <T>(request: Promise<ServiceResult<T>>, affectsEntries: boolean): Promise<ServiceResult<T>> => {
    const result = await request;
    const keys = affectsEntries && result.data
      ? [SAVED_SEARCHES_QUERY_KEY, ...JOURNAL_ENTRY_QUERY_KEYS]
      : [PEOPLE_QUERY_KEY];
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    return result;
  }, [queryClient]);

  return {
    list,
    people,
    rename: useCallback((id: number, name: string) => run(service.rename(id, name), false), [run, service]),
    merge: useCallback((id: number, duplicateId: number) => run(service.merge(id, duplicateId), true), [run, service]),
    remove: useCallback((id: number) => run(service.remove(id), true), [run, service]),
  };
}

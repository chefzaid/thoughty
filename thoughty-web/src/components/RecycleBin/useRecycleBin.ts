import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { JOURNAL_ENTRY_QUERY_KEYS } from '../../hooks/useEntriesState';
import { createRecycleBinService, type ServiceResult } from '../../services/api';

export const RECYCLE_BIN_QUERY_KEY = ['recycleBin'] as const;
export const RECYCLE_BIN_PAGE_SIZE = 20;

/** One page of the recycle bin, and the actions that empty it or bring entries back. */
export function useRecycleBin(page: number) {
  const service = useAuthenticatedService(createRecycleBinService);
  const queryClient = useQueryClient();

  const bin = useQuery({
    queryKey: [...RECYCLE_BIN_QUERY_KEY, page],
    queryFn: async () => {
      const result = await service.fetchPage(page, RECYCLE_BIN_PAGE_SIZE);
      if (!result.data) {
        throw new Error(result.error ?? 'Failed to load the recycle bin');
      }
      return result.data;
    },
    placeholderData: keepPreviousData,
  });

  /** Runs an action, then reloads the bin and, when entries came back, the journal. */
  const run = useCallback(async <T>(request: Promise<ServiceResult<T>>, refreshesJournal: boolean) => {
    const result = await request;
    const refreshes = [queryClient.invalidateQueries({ queryKey: RECYCLE_BIN_QUERY_KEY })];
    if (result.data && refreshesJournal) {
      refreshes.push(...JOURNAL_ENTRY_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    }
    await Promise.all(refreshes);
    return result;
  }, [queryClient]);

  return {
    bin,
    restore: useCallback((ids: number[]) => run(service.restore(ids), true), [run, service]),
    restoreAll: useCallback(() => run(service.restoreAll(), true), [run, service]),
    deletePermanently: useCallback((ids: number[]) => run(service.deletePermanently(ids), false), [run, service]),
    empty: useCallback(() => run(service.empty(), false), [run, service]),
  };
}

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createEntryReaderService, type EntryReaderPage } from '../../services/api/entryReaderService';

/** Under the journal's entry queries, so saving, deleting or restoring an entry reads the page again too. */
export const READER_QUERY_KEY = ['app', 'entries', 'reader'] as const;
/** A page just read, or read ahead, is shown again without asking for a while. */
const FRESH_MS = 60_000;

const pageKey = (scope: string, entryId: number | null) => [...READER_QUERY_KEY, scope, entryId] as const;

/**
 * The entry being read and its neighbours. The previous page stays on screen while the next one loads, and
 * both neighbours are read ahead, so turning the page shows the next entry at once.
 */
export function useEntryReaderPage(scope: string, entryId: number | null) {
  const service = useAuthenticatedService(createEntryReaderService);
  const queryClient = useQueryClient();

  const load = useCallback(async (id: number | null): Promise<EntryReaderPage> => {
    const result = await service.read(scope, id);
    if (!result.data) throw new Error(result.error ?? 'readerLoadFailed');
    return result.data;
  }, [scope, service]);

  const query = useQuery({
    queryKey: pageKey(scope, entryId),
    queryFn: () => load(entryId),
    placeholderData: keepPreviousData,
    staleTime: FRESH_MS,
    retry: false,
  });

  const page = query.data ?? null;
  useEffect(() => {
    if (!page || query.isPlaceholderData) return;
    // The first entry, once known, is also the page of its own ID, which the address moves to
    if (entryId === null) queryClient.setQueryData(pageKey(scope, page.entry.id), page);
    for (const neighbour of [page.previousId, page.nextId]) {
      if (neighbour !== null) {
        void queryClient.prefetchQuery({ queryKey: pageKey(scope, neighbour), queryFn: () => load(neighbour), staleTime: FRESH_MS, retry: false });
      }
    }
  }, [entryId, load, page, query.isPlaceholderData, queryClient, scope]);

  return {
    page,
    /** Whether the page on screen is the one asked for (not the previous one, kept while it loads). */
    current: page !== null && !query.isPlaceholderData,
    loading: query.isFetching,
    error: query.isError ? query.error.message : null,
    retry: query.refetch,
  };
}

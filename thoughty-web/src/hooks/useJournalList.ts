import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { EntriesBatch, Entry } from '../types';
import type { EntryBatchPosition, EntryListQuery } from '../services/api/entryListQuery';
import { useApiServices } from './useApiServices';

/** Entries the journal reads at a time as the list nears its end. */
export const JOURNAL_BATCH_SIZE = 20;
/**
 * Batches the journal keeps at most (200 entries): scrolling on lets go of the batches at the other end, read
 * again when scrolling back, so a long journal stays as quick to scroll as a short one.
 */
export const JOURNAL_MAX_BATCHES = 10;
/** A meaning search has fifty matches at most: they come in one batch, in their order. */
const SEMANTIC_BATCH_SIZE = 50;
export const ENTRIES_QUERY_KEY = 'entries';

const EMPTY_BATCH: EntriesBatch = { entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] };
const EMPTY_ENTRIES: Entry[] = [];
const EMPTY_STRINGS: string[] = [];

/**
 * The entry the list opens around after a jump (a permalink, a month, a cross-reference or a random entry),
 * for the filters it was opened with: once they change, the list starts over from its first entry.
 * `filters` is null until the filters of the jump have applied; `jump` tells two jumps to the same entry apart.
 */
interface ListAnchor {
  entryId: number;
  jump: number;
  filters: string | null;
}

interface UseJournalListOptions {
  enabled: boolean;
  listQuery: EntryListQuery;
  /** Hears that the entry to open around is not among the filtered entries; the list opens at its start instead. */
  onAnchorMissing?: (entryId: number) => void;
}

type JournalPages = InfiniteData<EntriesBatch, EntryBatchPosition>;

/**
 * The journal list as infinite scroll: batches read from the start or around an entry, then more of them
 * before or after as the writer scrolls, each batch starting at a cursor so nothing repeats or goes missing.
 */
export function useJournalList({ enabled, listQuery, onAnchorMissing }: UseJournalListOptions) {
  const { entriesService } = useApiServices();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<ListAnchor | null>(null);
  const jumpRef = useRef(0);
  const anchorMissingRef = useRef(onAnchorMissing);
  useEffect(() => {
    anchorMissingRef.current = onAnchorMissing;
  }, [onAnchorMissing]);

  const filtersKey = useMemo(() => JSON.stringify(listQuery), [listQuery]);
  const anchorApplies = anchor !== null && (anchor.filters === null || anchor.filters === filtersKey);
  // An anchor belongs to the filters the list is first read with once it is set (the filters a jump resets
  // have settled by then); a later change of filters starts the list over
  useEffect(() => {
    if (anchor?.filters === null && enabled) {
      setAnchor({ ...anchor, filters: filtersKey });
    } else if (anchor?.filters && anchor.filters !== filtersKey) {
      setAnchor(null);
    }
  }, [anchor, enabled, filtersKey]);

  const anchorId = anchorApplies ? anchor.entryId : null;
  const jump = anchorApplies ? anchor.jump : 0;
  const limit = listQuery.entryIds ? SEMANTIC_BATCH_SIZE : JOURNAL_BATCH_SIZE;
  const queryKey = useMemo(() => ['app', ENTRIES_QUERY_KEY, listQuery, anchorId, jump] as const, [anchorId, jump, listQuery]);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }): Promise<EntriesBatch> => {
      let position = pageParam;
      if ('around' in position) {
        // Read again (after a change is saved), the window starts at its own first entry, even once the
        // entry it opened at is gone
        const shown = queryClient.getQueryData<JournalPages>(queryKey)?.pages[0];
        if (shown) position = shown.prevCursor ? { from: shown.prevCursor } : {};
      }
      const result = await entriesService.fetchEntries(listQuery, limit, position);
      if (result === 'notFound') {
        anchorMissingRef.current?.(anchorId ?? 0);
        const start = await entriesService.fetchEntries(listQuery, limit, {});
        if (start === 'notFound' || start === null) throw new Error('entriesLoadFailed');
        return start;
      }
      if (result === null) throw new Error('entriesLoadFailed');
      return result;
    },
    initialPageParam: (anchorId ? { around: anchorId } : {}) as EntryBatchPosition,
    getNextPageParam: (last): EntryBatchPosition | undefined => (last.nextCursor ? { after: last.nextCursor } : undefined),
    getPreviousPageParam: (first): EntryBatchPosition | undefined => (first.prevCursor ? { before: first.prevCursor } : undefined),
    maxPages: JOURNAL_MAX_BATCHES,
    enabled,
    placeholderData: keepPreviousData,
  });

  const pages = query.data?.pages;
  const entries = useMemo(() => (pages ? pages.flatMap((page) => page.entries) : EMPTY_ENTRIES), [pages]);
  const first = pages?.[0] ?? EMPTY_BATCH;

  /** Changes the entries shown (a ticked task, a reordered day) without reading them again. */
  const setEntries = useCallback((next: Entry[] | ((previous: Entry[]) => Entry[])) => {
    queryClient.setQueryData<JournalPages>(queryKey, (current) => {
      if (!current) return current;
      const previous = current.pages.flatMap((page) => page.entries);
      const resolved = typeof next === 'function' ? next(previous) : next;
      // Each batch keeps its size, so its cursors still name its first and last entries
      let start = 0;
      return {
        ...current,
        pages: current.pages.map((page, index) => {
          const end = index === current.pages.length - 1 ? resolved.length : start + page.entries.length;
          const slice = resolved.slice(start, end);
          start = end;
          return { ...page, entries: slice };
        }),
      };
    });
  }, [queryClient, queryKey]);

  /** Opens the list around an entry, under the filters set with it; null goes back to the start of the list. */
  const openListAt = useCallback((entryId: number | null) => {
    jumpRef.current += 1;
    setAnchor(entryId === null ? null : { entryId, jump: jumpRef.current, filters: null });
  }, []);

  const { fetchNextPage, fetchPreviousPage, hasNextPage, hasPreviousPage, isFetchingNextPage, isFetchingPreviousPage } = query;
  const loadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const loadNewer = useCallback(() => {
    if (hasPreviousPage && !isFetchingPreviousPage) void fetchPreviousPage();
  }, [fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage]);

  return {
    entries,
    total: first.total,
    /** Entries listed before the first one shown. */
    offset: first.offset,
    allTags: pages ? first.allTags : EMPTY_STRINGS,
    /** The first batch is loading, or the list is read again (new filters, a jump, a change saved). */
    reloading: query.isLoading || (query.isFetching && !isFetchingNextPage && !isFetchingPreviousPage),
    hasOlder: hasNextPage,
    hasNewer: hasPreviousPage,
    loadingOlder: isFetchingNextPage,
    loadingNewer: isFetchingPreviousPage,
    /** A batch before or after the ones shown could not be read; loading it again retries. */
    loadError: query.isFetchNextPageError || query.isFetchPreviousPageError,
    loadOlder,
    loadNewer,
    /** Increases with every jump, so the list scrolls to its target even when it is the same entry again. */
    jump,
    openListAt,
    setEntries,
    refetch: query.refetch,
  };
}

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { normalizeReaderScope } from '../../services/api/entryReaderService';
import { ENTRY_READER_PARAM, ENTRY_READER_SCOPE_PARAM } from '../../utils/appRouting';

/** The `read` value that opens a reading at its first entry, before the reader knows which one that is. */
const FIRST_ENTRY = 'first';

/**
 * The reader, kept in the journal address beside the diary (`?diary=2&read=42&readIn=tags%3Dwalks`) so a reload
 * or a bookmark reads the same entry among the same filters: opening it adds a history step, turning the page
 * and closing replace it.
 */
export function useEntryReaderRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const read = searchParams.get(ENTRY_READER_PARAM);
  const isOpen = read !== null;
  const entryId = read && /^[1-9]\d{0,9}$/.test(read) ? Number(read) : null;
  const scope = normalizeReaderScope(searchParams.get(ENTRY_READER_SCOPE_PARAM) ?? '');

  const write = useCallback((entry: number | null, nextScope: string | null, replace: boolean) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set(ENTRY_READER_PARAM, entry ? String(entry) : FIRST_ENTRY);
      if (nextScope !== null) {
        if (nextScope) params.set(ENTRY_READER_SCOPE_PARAM, nextScope);
        else params.delete(ENTRY_READER_SCOPE_PARAM);
      }
      return params;
    }, { replace });
  }, [setSearchParams]);

  /** Opens the reader on these filters (a reader scope), at the given entry or else its first one. */
  const open = useCallback(
    (nextScope: string, entry: number | null = null) => write(entry, normalizeReaderScope(nextScope), false),
    [write],
  );

  /** Shows another entry of the same reading, or its first one with null. */
  const show = useCallback((entry: number | null) => write(entry, null, true), [write]);

  const close = useCallback(() => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.delete(ENTRY_READER_PARAM);
      params.delete(ENTRY_READER_SCOPE_PARAM);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  return { isOpen, entryId, scope, open, show, close };
}

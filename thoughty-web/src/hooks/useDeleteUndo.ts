import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { RECYCLE_BIN_QUERY_KEY } from '../components/RecycleBin/useRecycleBin';
import { createRecycleBinService, RECYCLE_BIN_SELECTION_MAX } from '../services/api';
import { pluralPhrase } from '../utils/pluralPhrase';
import { useAuthenticatedService } from './useAuthenticatedService';
import type { Notifier } from './useAppNotice';

/**
 * Puts the entries back where they were in their day, a request per hundred entries in the order given (oldest
 * day first, in their order within it), and says how it went. A failure shows the API's coded error and stops.
 */
async function restoreInPlace(
  restore: ReturnType<typeof createRecycleBinService>['restore'],
  entryIds: readonly number[],
): Promise<{ restoredCount: number; error: string | null }> {
  let restoredCount = 0;
  for (let start = 0; start < entryIds.length; start += RECYCLE_BIN_SELECTION_MAX) {
    const result = await restore(entryIds.slice(start, start + RECYCLE_BIN_SELECTION_MAX), { inPlace: true });
    if (!result.data) {
      return { restoredCount, error: result.error };
    }
    restoredCount += result.data.restoredCount;
  }
  return { restoredCount, error: null };
}

/**
 * The Undo the notice offers after entries go to the recycle bin: it restores exactly those entries to their
 * place, refreshes the journal (`onRestored`) and the bin, and says how many came back or why none could.
 */
export function useDeleteUndo(onRestored: () => void, { notify, t, language }: Notifier) {
  const service = useAuthenticatedService(createRecycleBinService);
  const queryClient = useQueryClient();

  const undo = useCallback(async (entryIds: readonly number[]) => {
    const { restoredCount, error } = await restoreInPlace(service.restore, entryIds);
    if (restoredCount > 0) {
      onRestored();
    }
    void queryClient.invalidateQueries({ queryKey: RECYCLE_BIN_QUERY_KEY });
    notify(error
      ? t(error)
      : t('recycleBinRestored', { entries: pluralPhrase(t, 'recycleBinEntries', restoredCount, language) }));
  }, [language, notify, onRestored, queryClient, service, t]);

  /** Tells the reader the entries are in the recycle bin, with an Undo that brings them back. */
  return useCallback((entryIds: readonly number[]) => {
    if (entryIds.length === 0) return;
    notify(pluralPhrase(t, 'recycleBinMovedHere', entryIds.length, language), {
      label: t('recycleBinUndo'),
      run: () => { void undo(entryIds); },
    });
  }, [language, notify, t, undo]);
}

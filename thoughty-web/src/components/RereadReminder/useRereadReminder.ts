import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { JOURNAL_ENTRY_QUERY_KEYS } from '../../hooks/useEntriesState';
import { createRereadReminderService, type EntryMutationResult, type ServiceResult } from '../../services/api';
import { formatEntryDate } from '../../utils/entryDate';

/** Sets and clears an entry's reread reminder, then reloads the journal so its card shows the change. */
export function useRereadReminder() {
  const service = useAuthenticatedService(createRereadReminderService);
  const queryClient = useQueryClient();

  const refreshAfter = useCallback(async (request: Promise<ServiceResult<EntryMutationResult>>) => {
    const result = await request;
    if (result.data) {
      await Promise.all(JOURNAL_ENTRY_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    }
    return result;
  }, [queryClient]);

  return {
    /** Asks to reread the entry on `rereadOn`, measured from the writer's own day. */
    set: useCallback(
      (entryId: number, rereadOn: string) => refreshAfter(service.set(entryId, rereadOn, formatEntryDate(new Date()))),
      [refreshAfter, service],
    ),
    clear: useCallback((entryId: number) => refreshAfter(service.clear(entryId)), [refreshAfter, service]),
  };
}

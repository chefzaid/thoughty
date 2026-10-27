import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import {
  createEntryCalendarService,
  type EntryCalendarItem,
  type EntryCalendarQuery,
} from '../../services/api';

/** Under the journal's entry queries, so saving, deleting or restoring an entry reloads the month too. */
export const CALENDAR_QUERY_KEY = ['app', 'entries', 'calendar'] as const;
const NO_ENTRIES: readonly EntryCalendarItem[] = [];

/** A month's entries matching the journal filters, grouped by day in each day's order. */
export function useCalendarMonth(query: EntryCalendarQuery) {
  const service = useAuthenticatedService(createEntryCalendarService);
  const result = useQuery({
    queryKey: [...CALENDAR_QUERY_KEY, query],
    queryFn: async () => {
      const response = await service.fetchMonth(query);
      if (!response.data) {
        throw new Error(response.error ?? 'calendarLoadFailed');
      }
      return response.data;
    },
    placeholderData: keepPreviousData,
  });

  const shownMonth = result.data?.month === query.month ? result.data.entries : NO_ENTRIES;
  const entriesByDate = useMemo(() => {
    const byDate = new Map<string, EntryCalendarItem[]>();
    for (const entry of shownMonth) {
      const day = byDate.get(entry.date) ?? [];
      day.push(entry);
      byDate.set(entry.date, day);
    }
    return byDate;
  }, [shownMonth]);

  return {
    entriesByDate,
    total: shownMonth.length,
    loading: result.isFetching,
    failed: result.isError,
    retry: result.refetch,
  };
}

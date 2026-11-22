import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createCalendarEventsService, type CalendarEvent, type ServiceResult } from '../../services/api';
import { browserTimeZone } from '../../utils/timeZone';

export const CALENDAR_QUERY_KEY = ['calendar'] as const;
const NO_EVENTS: readonly CalendarEvent[] = [];

async function dataOf<T>(request: Promise<ServiceResult<T>>, fallback: string): Promise<T> {
  const result = await request;
  if (!result.data) {
    throw new Error(result.error ?? fallback);
  }
  return result.data;
}

/** The imported events on a day (`YYYY-MM-DD`) in the browser's time zone; none while they load or when none were imported. */
export function useCalendarDay(date: string): readonly CalendarEvent[] {
  const service = useAuthenticatedService(createCalendarEventsService);
  const timeZone = browserTimeZone();
  const day = useQuery({
    queryKey: [...CALENDAR_QUERY_KEY, 'day', date, timeZone],
    queryFn: () => dataOf(service.eventsOn(date, timeZone), 'calendarEventsLoadFailed'),
  });
  return day.data?.events ?? NO_EVENTS;
}

/**
 * How many events are imported, with the calls that import a file and remove every imported event.
 * Each reloads the summary and the days the composer showed.
 */
export function useCalendarImport() {
  const service = useAuthenticatedService(createCalendarEventsService);
  const queryClient = useQueryClient();
  const summary = useQuery({
    queryKey: [...CALENDAR_QUERY_KEY, 'summary'],
    queryFn: () => dataOf(service.summary(), 'calendarEventsLoadFailed'),
  });

  const run = useCallback(async <T>(request: Promise<ServiceResult<T>>): Promise<ServiceResult<T>> => {
    const result = await request;
    if (result.data) {
      await queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY });
    }
    return result;
  }, [queryClient]);

  return {
    summary,
    importFile: useCallback((file: File) => run(service.importFile(file, browserTimeZone())), [run, service]),
    clear: useCallback(() => run(service.clear()), [run, service]),
  };
}

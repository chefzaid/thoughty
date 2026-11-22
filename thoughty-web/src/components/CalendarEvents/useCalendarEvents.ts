import { useCallback, useMemo } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createCalendarEventsService, type CalendarEvent, type ServiceResult } from '../../services/api';
import { browserTimeZone } from '../../utils/timeZone';

export const CALENDAR_QUERY_KEY = ['calendar'] as const;
const NO_EVENTS: readonly CalendarEvent[] = [];
const NO_DAYS: ReadonlyMap<string, readonly CalendarEvent[]> = new Map();
/** The most days one request asks for, as the API takes them: the journal keeps up to 200 entries loaded. */
export const CALENDAR_DAYS_LIMIT = 200;

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

/** How many events are imported and when a calendar was last imported. */
function useCalendarSummary() {
  const service = useAuthenticatedService(createCalendarEventsService);
  return useQuery({
    queryKey: [...CALENDAR_QUERY_KEY, 'summary'],
    queryFn: () => dataOf(service.summary(), 'calendarEventsLoadFailed'),
  });
}

/**
 * The imported events on each of several days (`YYYY-MM-DD`) in the browser's time zone, by day, in
 * one request; only asked for once a calendar is imported. While other days load, the days shown
 * keep their events; none once the imported events are removed.
 */
export function useCalendarDays(dates: readonly string[]): ReadonlyMap<string, readonly CalendarEvent[]> {
  const service = useAuthenticatedService(createCalendarEventsService);
  const timeZone = browserTimeZone();
  const imported = (useCalendarSummary().data?.eventCount ?? 0) > 0;
  const days = useMemo(() => [...new Set(dates)].sort().slice(-CALENDAR_DAYS_LIMIT), [dates]);
  const query = useQuery({
    queryKey: [...CALENDAR_QUERY_KEY, 'days', days.join(','), timeZone],
    queryFn: () => dataOf(service.eventsOnDays(days, timeZone), 'calendarEventsLoadFailed'),
    enabled: imported && days.length > 0,
    placeholderData: keepPreviousData,
  });
  return useMemo(
    () => (imported && query.data ? new Map(query.data.days.map((day) => [day.date, day.events])) : NO_DAYS),
    [imported, query.data],
  );
}

/**
 * How many events are imported, with the calls that import a file and remove every imported event.
 * Each reloads the summary and the days the composer and the journal showed.
 */
export function useCalendarImport() {
  const service = useAuthenticatedService(createCalendarEventsService);
  const queryClient = useQueryClient();
  const summary = useCalendarSummary();

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

import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type CalendarEvent = components['schemas']['CalendarEventResponseDto'];
export type CalendarDay = components['schemas']['CalendarDayResponseDto'];
export type CalendarDays = components['schemas']['CalendarDaysResponseDto'];
export type CalendarSummary = components['schemas']['CalendarSummaryResponseDto'];
export type CalendarImportResult = components['schemas']['CalendarImportResponseDto'];
type CalendarClearResult = components['schemas']['SuccessResponseDto'];

/** The events of the calendar files the writer imported. Errors are translation keys, or the API's coded reason. */
export const createCalendarEventsService = (authFetch: AuthFetchFunction) => ({
  summary(): Promise<ServiceResult<CalendarSummary>> {
    return requestJson(authFetch('/api/calendar'), 'calendarEventsLoadFailed');
  },

  /** The events of a day (`YYYY-MM-DD`) in the writer's time zone. */
  eventsOn(date: string, timeZone: string): Promise<ServiceResult<CalendarDay>> {
    const query = new URLSearchParams({ date, timeZone });
    return requestJson(authFetch(`/api/calendar/events?${query}`), 'calendarEventsLoadFailed');
  },

  /** The events of several days (`YYYY-MM-DD`) in the writer's time zone; only the days that have events come back. */
  eventsOnDays(dates: readonly string[], timeZone: string): Promise<ServiceResult<CalendarDays>> {
    const query = new URLSearchParams({ dates: dates.join(','), timeZone });
    return requestJson(authFetch(`/api/calendar/days?${query}`), 'calendarEventsLoadFailed');
  },

  /** Sends a calendar file; times without a zone of their own are read in `timeZone`. */
  importFile(file: File, timeZone: string): Promise<ServiceResult<CalendarImportResult>> {
    const form = new FormData();
    form.append('file', file);
    const query = new URLSearchParams({ timeZone });
    return requestJson(authFetch(`/api/calendar/import?${query}`, { method: 'POST', body: form }), 'calendarImportFailed');
  },

  clear(): Promise<ServiceResult<CalendarClearResult>> {
    return requestJson(authFetch('/api/calendar', { method: 'DELETE' }), 'calendarClearFailed');
  },
});

export type CalendarEventsService = ReturnType<typeof createCalendarEventsService>;

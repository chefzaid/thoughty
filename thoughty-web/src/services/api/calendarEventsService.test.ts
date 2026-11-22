import { describe, expect, it, vi } from 'vitest';

import { createCalendarEventsService } from './calendarEventsService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('calendarEventsService', () => {
  it('sums up, lists a day, imports a file and removes the imported events', async () => {
    const authFetch = vi.fn().mockImplementation(async () => ok({ events: [] }));
    const service = createCalendarEventsService(authFetch);
    const file = new File(['BEGIN:VCALENDAR'], 'calendar.ics', { type: 'text/calendar' });

    await service.summary();
    await expect(service.eventsOn('2026-11-22', 'Europe/Paris')).resolves.toEqual({ data: { events: [] }, error: null });
    await service.importFile(file, 'Europe/Paris');
    await service.clear();

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['/api/calendar', undefined],
      ['/api/calendar/events?date=2026-11-22&timeZone=Europe%2FParis', undefined],
      ['/api/calendar/import?timeZone=Europe%2FParis', 'POST'],
      ['/api/calendar', 'DELETE'],
    ]);
    const body = authFetch.mock.calls[2]?.[1]?.body as FormData;
    expect(body.get('file')).toBe(file);
  });

  it('gives the API error code to translate, or a translation key when the request fails', async () => {
    const refused = new Response(
      JSON.stringify({ statusCode: 400, message: 'This file is not a calendar (.ics)', code: 'CALENDAR_FILE_INVALID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
    const service = createCalendarEventsService(vi.fn().mockResolvedValueOnce(refused).mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = new File(['hello'], 'notes.txt');

    await expect(service.importFile(file, 'UTC')).resolves.toEqual({ data: null, error: 'apiError_CALENDAR_FILE_INVALID' });
    await expect(service.importFile(file, 'UTC')).resolves.toEqual({ data: null, error: 'calendarImportFailed' });
    await expect(service.clear()).resolves.toEqual({ data: null, error: 'calendarClearFailed' });
    await expect(service.summary()).resolves.toEqual({ data: null, error: 'calendarEventsLoadFailed' });
  });
});

import { describeContract } from './contract-suite';

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:dinner@example',
  'SUMMARY:Dinner with Lina',
  'LOCATION:Le Petit Zinc',
  'DTSTART;TZID=Europe/Paris:20261122T193000',
  'DTEND;TZID=Europe/Paris:20261122T220000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:market@example',
  'SUMMARY:Market',
  'DTSTART;VALUE=DATE:20261122',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:yoga@example',
  'SUMMARY:Yoga',
  'DTSTART:20261102T180000Z',
  'RRULE:FREQ=WEEKLY',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const icsFile = (text: string, filename = 'calendar.ics') => ({
  files: [{ field: 'file', buffer: Buffer.from(text), filename, contentType: 'text/calendar' }],
});

describeContract('calendar', (context) => {
  const call: typeof context.client.call = (operation, options) => context.client.call(operation, options);

  it('imports a calendar file, lists a day’s events in the writer’s zone, and removes them', async () => {
    const { alice, bob } = context;
    expect((await call('GET /api/calendar', { as: alice, status: 200 })).body).toEqual({ eventCount: 0, lastImportedAt: null, limit: 10000 });

    const imported = await call('POST /api/calendar/import', {
      as: alice,
      query: { timeZone: 'Europe/Paris' },
      multipart: icsFile(ICS),
      status: 201,
    });
    expect(imported.body).toEqual({ imported: 2, skippedRecurring: 1, eventCount: 2 });

    const day = await call('GET /api/calendar/events', { as: alice, query: { date: '2026-11-22', timeZone: 'Europe/Paris' }, status: 200 });
    expect(day.body).toEqual({
      events: [
        { id: expect.any(Number), summary: 'Market', location: null, allDay: true, startsAt: null, endsAt: null, startDate: '2026-11-22', endDate: '2026-11-22' },
        {
          id: expect.any(Number),
          summary: 'Dinner with Lina',
          location: 'Le Petit Zinc',
          allDay: false,
          startsAt: '2026-11-22T18:30:00.000Z',
          endsAt: '2026-11-22T21:00:00.000Z',
          startDate: null,
          endDate: null,
        },
      ],
    });
    // Each writer sees only their own calendar
    expect((await call('GET /api/calendar/events', { as: bob, query: { date: '2026-11-22' }, status: 200 })).body).toEqual({ events: [] });

    await call('DELETE /api/calendar', { as: alice, status: 200 });
    expect((await call('GET /api/calendar', { as: alice, status: 200 })).body).toMatchObject({ eventCount: 0 });
  });

  it('refuses a file that is not a calendar, a missing one, and a bad day or zone', async () => {
    const { alice } = context;
    await call('POST /api/calendar/import', { as: alice, multipart: icsFile('hello', 'notes.txt'), status: 400, code: 'CALENDAR_FILE_INVALID' });
    await call('POST /api/calendar/import', { as: alice, multipart: {}, status: 400, code: 'CALENDAR_FILE_INVALID' });
    await call('GET /api/calendar/events', { as: alice, query: { date: '2026-02-30' }, status: 400, code: 'VALIDATION_FAILED' });
    await call('GET /api/calendar/events', { as: alice, query: { date: '2026-11-22', timeZone: '+05:30' }, status: 400, code: 'VALIDATION_FAILED' });
  });
});

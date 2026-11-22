import { parseIcs } from './ics-parser';

const calendar = (...events: string[][]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');

describe('parseIcs', () => {
  it('refuses text that is not a calendar', () => {
    expect(parseIcs('hello', 'UTC')).toBeNull();
    expect(parseIcs('', 'UTC')).toBeNull();
  });

  it('reads timed events in UTC, in their IANA zone, and floating ones in the writer’s zone', () => {
    const parsed = parseIcs(calendar(
      ['UID:utc', 'SUMMARY:Dentist', 'DTSTART:20261122T093000Z', 'DTEND:20261122T101500Z'],
      ['UID:zoned', 'SUMMARY:Dinner', 'DTSTART;TZID=Europe/Paris:20260715T193000', 'DTEND;TZID="Europe/Paris":20260715T220000'],
      ['UID:floating', 'SUMMARY:Run', 'DTSTART:20261122T070000'],
      ['UID:windows', 'SUMMARY:Call', 'DTSTART;TZID=Romance Standard Time:20261122T080000', 'DURATION:PT1H30M'],
    ), 'America/New_York');

    expect(parsed).toEqual({
      skippedRecurring: 0,
      events: [
        { uid: 'utc', summary: 'Dentist', location: null, allDay: false, startsAt: new Date('2026-11-22T09:30:00Z'), endsAt: new Date('2026-11-22T10:15:00Z') },
        { uid: 'zoned', summary: 'Dinner', location: null, allDay: false, startsAt: new Date('2026-07-15T17:30:00Z'), endsAt: new Date('2026-07-15T20:00:00Z') },
        // No end: an instant
        { uid: 'floating', summary: 'Run', location: null, allDay: false, startsAt: new Date('2026-11-22T12:00:00Z'), endsAt: new Date('2026-11-22T12:00:00Z') },
        // Not an IANA name: read in the writer's zone
        { uid: 'windows', summary: 'Call', location: null, allDay: false, startsAt: new Date('2026-11-22T13:00:00Z'), endsAt: new Date('2026-11-22T14:30:00Z') },
      ],
    });
  });

  it('reads all-day events with their last day included', () => {
    const parsed = parseIcs(calendar(
      ['UID:one', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20261225', 'DTEND;VALUE=DATE:20261226'],
      ['UID:trip', 'SUMMARY:Trip', 'DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261104'],
      ['UID:no-end', 'SUMMARY:Birthday', 'DTSTART;VALUE=DATE:20260301'],
      ['UID:duration', 'SUMMARY:Retreat', 'DTSTART;VALUE=DATE:20260501', 'DURATION:P1W'],
      ['UID:same-day-end', 'SUMMARY:Odd', 'DTSTART;VALUE=DATE:20260601', 'DTEND;VALUE=DATE:20260601'],
    ), 'UTC');

    expect(parsed?.events.map(({ uid, allDay, ...rest }) => ({ uid, allDay, ...('startDate' in rest ? { startDate: rest.startDate, endDate: rest.endDate } : {}) }))).toEqual([
      { uid: 'one', allDay: true, startDate: '2026-12-25', endDate: '2026-12-25' },
      { uid: 'trip', allDay: true, startDate: '2026-11-01', endDate: '2026-11-03' },
      { uid: 'no-end', allDay: true, startDate: '2026-03-01', endDate: '2026-03-01' },
      { uid: 'duration', allDay: true, startDate: '2026-05-01', endDate: '2026-05-07' },
      { uid: 'same-day-end', allDay: true, startDate: '2026-06-01', endDate: '2026-06-01' },
    ]);
  });

  it('unfolds lines, unescapes text, keeps it on one line and cuts it to 200 characters', () => {
    const long = 'a'.repeat(250);
    const parsed = parseIcs(calendar(
      ['UID:text', 'SUMMARY:Lunch\\, then a walk\\; with', '  Sam\\nand Lina', 'LOCATION:Caf\\\\é', 'DTSTART:20261122T120000Z'],
      ['UID:long', `SUMMARY:${long}`, 'DTSTART:20261122T120000Z'],
    ), 'UTC');

    expect(parsed?.events[0]).toMatchObject({ summary: 'Lunch, then a walk; with Sam and Lina', location: 'Caf\\é' });
    expect(parsed?.events[1].summary).toHaveLength(200);
  });

  it('counts repeating events and leaves them out, with changed occurrences, cancelled and broken events', () => {
    const parsed = parseIcs(calendar(
      ['UID:weekly', 'SUMMARY:Yoga', 'DTSTART:20261102T180000Z', 'RRULE:FREQ=WEEKLY'],
      ['UID:extra', 'SUMMARY:Extra', 'DTSTART:20261102T180000Z', 'RDATE:20261110T180000Z'],
      ['UID:weekly', 'SUMMARY:Yoga moved', 'DTSTART:20261110T190000Z', 'RECURRENCE-ID:20261109T180000Z'],
      ['UID:cancelled', 'SUMMARY:Off', 'STATUS:CANCELLED', 'DTSTART:20261102T180000Z'],
      ['UID:no-start', 'SUMMARY:Someday'],
      ['UID:bad-date', 'DTSTART;VALUE=DATE:20260230'],
      ['UID:bad-time', 'DTSTART:20261122T250000Z'],
      ['UID:garbage', 'DTSTART:tomorrow'],
      ['UID:kept', 'DTSTART:20261122T120000Z'],
    ), 'UTC');

    expect(parsed).toEqual({
      skippedRecurring: 2,
      events: [{ uid: 'kept', summary: '', location: null, allDay: false, startsAt: new Date('2026-11-22T12:00:00Z'), endsAt: new Date('2026-11-22T12:00:00Z') }],
    });
  });

  it('ignores the alarms inside an event and keeps the last of two events with one UID', () => {
    const parsed = parseIcs(calendar(
      ['UID:same', 'SUMMARY:First', 'DTSTART:20261122T120000Z', 'BEGIN:VALARM', 'SUMMARY:Alarm', 'TRIGGER:-PT15M', 'END:VALARM'],
      ['UID:same', 'SUMMARY:Second', 'DTSTART:20261123T120000Z'],
    ), 'UTC');

    expect(parsed?.events).toEqual([expect.objectContaining({ uid: 'same', summary: 'Second' })]);
  });

  it('gives an event without a UID, or with one too long, a stable one of its own', () => {
    const text = calendar(['SUMMARY:No uid', 'DTSTART:20261122T120000Z'], [`UID:${'u'.repeat(300)}`, 'DTSTART:20261122T120000Z']);
    const first = parseIcs(text, 'UTC');
    const second = parseIcs(text, 'UTC');

    expect(first?.events.map((event) => event.uid)).toEqual([expect.stringMatching(/^sha256:[0-9a-f]{64}$/), expect.stringMatching(/^sha256:[0-9a-f]{64}$/)]);
    expect(second?.events.map((event) => event.uid)).toEqual(first?.events.map((event) => event.uid));
  });

  it('keeps an end before the start at the start, ignores a zero or unreadable duration, and reads a byte order mark', () => {
    const parsed = parseIcs(`﻿${calendar(
      ['UID:backwards', 'DTSTART:20261122T120000Z', 'DTEND:20261122T110000Z'],
      ['UID:zero', 'DTSTART:20261122T120000Z', 'DURATION:PT0S'],
      ['UID:unreadable', 'DTSTART;VALUE=DATE:20261122', 'DURATION:soon'],
      ['UID:ends-on-date', 'DTSTART:20261122T120000Z', 'DTEND;VALUE=DATE:20261123'],
      ['UID:broken-line', 'no colon here', 'DTSTART:20261122T120000Z'],
    )}`, 'UTC');

    expect(parsed?.events).toEqual([
      expect.objectContaining({ uid: 'backwards', endsAt: new Date('2026-11-22T12:00:00Z') }),
      expect.objectContaining({ uid: 'zero', endsAt: new Date('2026-11-22T12:00:00Z') }),
      expect.objectContaining({ uid: 'unreadable', startDate: '2026-11-22', endDate: '2026-11-22' }),
      expect.objectContaining({ uid: 'ends-on-date', endsAt: new Date('2026-11-22T12:00:00Z') }),
      expect.objectContaining({ uid: 'broken-line', startsAt: new Date('2026-11-22T12:00:00Z') }),
    ]);
  });
});

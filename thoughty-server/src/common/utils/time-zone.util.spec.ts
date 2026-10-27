import { isValidTimeZone, localDateIn, zonedParts, zonedTimeToUtc } from './time-zone.util';

const at = (year: number, month: number, day: number, hour: number, timeZone: string) =>
  zonedTimeToUtc(year, month, day, hour, timeZone).toISOString();

describe('time-zone util', () => {
  it('recognizes IANA time zones and reads their wall clock', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(zonedParts(new Date('2026-10-27T22:00:00Z'), 'Asia/Tokyo')).toEqual({
      year: 2026, month: 10, day: 28, hour: 7, minute: 0, second: 0, weekday: 3,
    });
    expect(localDateIn(new Date('2026-10-27T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-28');
  });

  it('turns a wall-clock hour into its instant, rolling day overflow into the next month', () => {
    expect(at(2026, 10, 27, 8, 'UTC')).toBe('2026-10-27T08:00:00.000Z');
    expect(at(2026, 10, 32, 8, 'Europe/Paris')).toBe('2026-11-01T07:00:00.000Z');
    expect(at(2026, 13, 1, 0, 'America/New_York')).toBe('2027-01-01T05:00:00.000Z');
  });

  describe.each([
    {
      zone: 'Europe/Paris (east of UTC, northern)',
      timeZone: 'Europe/Paris',
      // 2026-03-29: 02:00 CET jumps to 03:00 CEST.
      skipped: [2026, 3, 29, 2, '2026-03-29T01:00:00.000Z'],
      // 2026-10-25: 03:00 CEST goes back to 02:00 CET; the first 02:00 is CEST (UTC+2).
      repeated: [2026, 10, 25, 2, '2026-10-25T00:00:00.000Z'],
      around: [[2026, 10, 25, 1, '2026-10-24T23:00:00.000Z'], [2026, 10, 25, 3, '2026-10-25T02:00:00.000Z']],
    },
    {
      zone: 'America/New_York (west of UTC, northern)',
      timeZone: 'America/New_York',
      // 2026-03-08: 02:00 EST jumps to 03:00 EDT.
      skipped: [2026, 3, 8, 2, '2026-03-08T07:00:00.000Z'],
      // 2026-11-01: 02:00 EDT goes back to 01:00 EST; the first 01:00 is EDT (UTC-4).
      repeated: [2026, 11, 1, 1, '2026-11-01T05:00:00.000Z'],
      around: [[2026, 11, 1, 0, '2026-11-01T04:00:00.000Z'], [2026, 11, 1, 2, '2026-11-01T07:00:00.000Z']],
    },
    {
      zone: 'Australia/Sydney (east of UTC, southern)',
      timeZone: 'Australia/Sydney',
      // 2026-10-04: 02:00 AEST jumps to 03:00 AEDT.
      skipped: [2026, 10, 4, 2, '2026-10-03T16:00:00.000Z'],
      // 2026-04-05: 03:00 AEDT goes back to 02:00 AEST; the first 02:00 is AEDT (UTC+11).
      repeated: [2026, 4, 5, 2, '2026-04-04T15:00:00.000Z'],
      around: [[2026, 4, 5, 1, '2026-04-04T14:00:00.000Z'], [2026, 4, 5, 3, '2026-04-04T17:00:00.000Z']],
    },
    {
      zone: 'America/Santiago (west of UTC, southern)',
      timeZone: 'America/Santiago',
      // 2026-09-06: 00:00 CLT (UTC-4) jumps to 01:00 CLST (UTC-3).
      skipped: [2026, 9, 6, 0, '2026-09-06T04:00:00.000Z'],
      // 2026-04-05: 00:00 CLST goes back to 23:00 CLT on the 4th; the first 23:00 is CLST (UTC-3).
      repeated: [2026, 4, 4, 23, '2026-04-05T02:00:00.000Z'],
      around: [[2026, 4, 4, 22, '2026-04-05T01:00:00.000Z'], [2026, 4, 5, 0, '2026-04-05T04:00:00.000Z']],
    },
  ] as const)('$zone', ({ timeZone, skipped, repeated, around }) => {
    it('moves an hour the clocks skip past the jump', () => {
      const [year, month, day, hour, expected] = skipped;
      expect(at(year, month, day, hour, timeZone)).toBe(expected);
      // The next hour is the same instant, so the skipped hour is read as its wall-clock successor.
      expect(at(year, month, day, hour + 1, timeZone)).toBe(expected);
    });

    it('lands a repeated hour on its first occurrence, which the wall clock reads as that hour', () => {
      const [year, month, day, hour, expected] = repeated;
      const instant = zonedTimeToUtc(year, month, day, hour, timeZone);
      expect(instant.toISOString()).toBe(expected);
      expect(zonedParts(instant, timeZone).hour).toBe(hour);
      // An hour later the wall clock reads the same hour again: the second occurrence, not chosen.
      expect(zonedParts(new Date(instant.getTime() + 3_600_000), timeZone).hour).toBe(hour);
      expect(zonedParts(new Date(instant.getTime() - 1), timeZone).hour).not.toBe(hour);
    });

    it('keeps the hours either side of a repeat on their single occurrence', () => {
      for (const [year, month, day, hour, expected] of around) {
        expect(at(year, month, day, hour, timeZone)).toBe(expected);
      }
    });
  });

  it('keeps a zone without daylight saving on its fixed offset through other zones’ changes', () => {
    // India is UTC+5:30 all year.
    expect(at(2026, 3, 29, 2, 'Asia/Kolkata')).toBe('2026-03-28T20:30:00.000Z');
    expect(at(2026, 10, 25, 2, 'Asia/Kolkata')).toBe('2026-10-24T20:30:00.000Z');
    expect(at(2026, 11, 1, 1, 'Asia/Kolkata')).toBe('2026-10-31T19:30:00.000Z');
  });
});

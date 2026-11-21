import { localDateIn } from './time-zone.util';
import { dayParts, isWritersDay, shiftDay, utcDay, writersDayOr } from './writers-day.util';

describe('the writer’s day', () => {
  it('takes the UTC day, or the day before or after it, as the writer’s day', () => {
    const now = new Date('2026-10-31T23:30:00Z');

    expect(isWritersDay('2026-10-31', now)).toBe(true);
    expect(isWritersDay('2026-10-30', now)).toBe(true);
    expect(isWritersDay('2026-11-01', now)).toBe(true);
    expect(isWritersDay('2026-11-02', now)).toBe(false);
    expect(isWritersDay('2026-10-29', now)).toBe(false);
  });

  it('accepts the day of the time zones furthest from UTC on either side of midnight', () => {
    // 00:30 on 1 November in Kiritimati (UTC+14) is 23:30 on 30 October in Pago Pago (UTC-11)
    for (const now of [new Date('2026-10-31T10:30:00Z'), new Date('2026-10-31T09:59:59Z'), new Date('2026-10-31T11:00:00Z')]) {
      expect(isWritersDay(localDateIn(now, 'Pacific/Kiritimati'), now)).toBe(true);
      expect(isWritersDay(localDateIn(now, 'Pacific/Pago_Pago'), now)).toBe(true);
    }
    expect(localDateIn(new Date('2026-10-31T10:30:00Z'), 'Pacific/Kiritimati')).toBe('2026-11-01');
    expect(localDateIn(new Date('2026-10-31T10:30:00Z'), 'Pacific/Pago_Pago')).toBe('2026-10-30');
  });

  it('falls back to the UTC day when the request names none', () => {
    const now = new Date('2026-10-31T23:30:00Z');

    expect(utcDay(now)).toBe('2026-10-31');
    expect(writersDayOr(undefined, now)).toBe('2026-10-31');
    expect(writersDayOr('2026-11-01', now)).toBe('2026-11-01');
  });

  it('splits a day into its year, month and day', () => {
    expect(dayParts('2026-03-09')).toEqual({ year: 2026, month: 3, day: 9 });
  });

  it('moves a day forward or back across months, years and leap days', () => {
    expect(shiftDay('2026-11-21', -6)).toBe('2026-11-15');
    expect(shiftDay('2026-03-03', -6)).toBe('2026-02-25');
    expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDay('2026-12-29', 6)).toBe('2027-01-04');
  });
});

import { describe, expect, it } from 'vitest';
import { formatEntryDate, writersToday } from './entryDate';

describe('the writer’s day', () => {
  it('formats a date as its local day', () => {
    expect(formatEntryDate(new Date(2026, 2, 9, 23, 59))).toBe('2026-03-09');
  });

  it.each([
    // 10:30 UTC on 31 October: 00:30 on 1 November in Kiritimati (UTC+14), 23:30 on 30 October in Pago Pago (UTC-11)
    ['Pacific/Kiritimati', '2026-10-31T10:30:00Z', '2026-11-01'],
    ['Pacific/Pago_Pago', '2026-10-31T10:30:00Z', '2026-10-30'],
    ['Pacific/Kiritimati', '2026-12-31T10:00:00Z', '2027-01-01'],
    ['Pacific/Pago_Pago', '2027-01-01T10:59:00Z', '2026-12-31'],
    ['UTC', '2026-10-31T10:30:00Z', '2026-10-31'],
  ])('is the day on the writer’s clock in %s at %s', (timeZone, instant, day) => {
    expect(writersToday(new Date(instant), timeZone)).toBe(day);
  });

  it('reads the browser’s clock and time zone by default', () => {
    expect(writersToday()).toBe(formatEntryDate(new Date()));
  });
});

import { DEFAULT_MONTHLY_RECAP_HOUR, MONTHLY_RECAP_SCHEDULE, monthBefore, monthRange, nextMonthlySend } from './monthly-recap-schedule';

const next = (after: string, hour: number, timeZone: string) => nextMonthlySend(new Date(after), hour, timeZone).toISOString();

describe('monthly recap schedule', () => {
  it('defaults to eight in the morning and keeps one email per local month', () => {
    expect(DEFAULT_MONTHLY_RECAP_HOUR).toBe(8);
    expect(MONTHLY_RECAP_SCHEDULE.defaultHour).toBe(8);
    expect(MONTHLY_RECAP_SCHEDULE.period('2026-11-01')).toBe(MONTHLY_RECAP_SCHEDULE.period('2026-11-30'));
    expect(MONTHLY_RECAP_SCHEDULE.period('2026-11-01')).not.toBe(MONTHLY_RECAP_SCHEDULE.period('2026-12-01'));
    expect(MONTHLY_RECAP_SCHEDULE.next).toBe(nextMonthlySend);
  });

  it('sends on the coming 1st at the hour, or later today when it is the 1st and the hour is to come', () => {
    expect(next('2026-10-27T09:00:00Z', 8, 'UTC')).toBe('2026-11-01T08:00:00.000Z');
    expect(next('2026-11-01T07:59:59Z', 8, 'UTC')).toBe('2026-11-01T08:00:00.000Z');
    expect(next('2026-11-01T08:00:00Z', 8, 'UTC')).toBe('2026-12-01T08:00:00.000Z');
    expect(next('2026-12-15T00:00:00Z', 0, 'UTC')).toBe('2027-01-01T00:00:00.000Z');
  });

  it('finds the 1st on the writer’s wall clock, whatever the UTC day', () => {
    // 2026-10-31 20:00 UTC is already 1 November, 05:00, in Tokyo (UTC+9).
    expect(next('2026-10-31T20:00:00Z', 8, 'Asia/Tokyo')).toBe('2026-10-31T23:00:00.000Z');
    // 2026-11-01 03:00 UTC is still 31 October, 20:00, in Los Angeles; its 08:00 on the 1st is already PST (UTC-8).
    expect(next('2026-11-01T03:00:00Z', 8, 'America/Los_Angeles')).toBe('2026-11-01T16:00:00.000Z');
    // India is UTC+5:30.
    expect(next('2026-10-20T00:00:00Z', 8, 'Asia/Kolkata')).toBe('2026-11-01T02:30:00.000Z');
  });

  it('keeps the local hour across daylight-saving changes between two sends', () => {
    // Paris is on summer time on 1 October (UTC+2) and on winter time on 1 November (UTC+1).
    expect(next('2026-09-15T12:00:00Z', 8, 'Europe/Paris')).toBe('2026-10-01T06:00:00.000Z');
    expect(next('2026-10-01T06:00:00Z', 8, 'Europe/Paris')).toBe('2026-11-01T07:00:00.000Z');
    // New York changes on 1 November 2026 at 02:00: 08:00 that morning is already EST (UTC-5).
    expect(next('2026-10-15T12:00:00Z', 8, 'America/New_York')).toBe('2026-11-01T13:00:00.000Z');
    // …and 01:00, which the clocks live twice that night, is sent once, then next month.
    const repeated = next('2026-10-15T12:00:00Z', 1, 'America/New_York');
    expect(['2026-11-01T05:00:00.000Z', '2026-11-01T06:00:00.000Z']).toContain(repeated);
    expect(next(repeated, 1, 'America/New_York')).toBe('2026-12-01T06:00:00.000Z');
    // Paris skips 02:00 on 29 March 2026, a Sunday but not a 1st: 1 March and 1 April keep their hour.
    expect(next('2026-03-01T01:00:00Z', 2, 'Europe/Paris')).toBe('2026-04-01T00:00:00.000Z');
  });

  it('looks back on the month just ended, across a year end, with its first and last day', () => {
    expect(monthBefore('2026-11-01')).toEqual({ year: 2026, month: 10 });
    expect(monthBefore('2027-01-01')).toEqual({ year: 2026, month: 12 });
    expect(monthRange({ year: 2026, month: 10 })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange({ year: 2026, month: 2 })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

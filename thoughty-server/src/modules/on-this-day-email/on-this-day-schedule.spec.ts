import { DEFAULT_ON_THIS_DAY_HOUR, nextDailySend } from './on-this-day-schedule';

const next = (after: string, hour: number, timeZone: string) => nextDailySend(new Date(after), hour, timeZone).toISOString();

describe('nextDailySend', () => {
  it('defaults to eight in the morning', () => {
    expect(DEFAULT_ON_THIS_DAY_HOUR).toBe(8);
  });

  it('sends later today when the hour has not come yet, otherwise tomorrow', () => {
    expect(next('2026-10-27T06:59:59Z', 7, 'UTC')).toBe('2026-10-27T07:00:00.000Z');
    expect(next('2026-10-27T07:00:00Z', 7, 'UTC')).toBe('2026-10-28T07:00:00.000Z');
    expect(next('2026-12-31T23:30:00Z', 0, 'UTC')).toBe('2027-01-01T00:00:00.000Z');
  });

  it('reads the hour on the writer’s wall clock, whatever the UTC day', () => {
    // 2026-10-27 22:00 UTC is already the 28th, 07:00, in Tokyo (UTC+9).
    expect(next('2026-10-27T22:00:00Z', 8, 'Asia/Tokyo')).toBe('2026-10-27T23:00:00.000Z');
    // 2026-10-28 03:00 UTC is still the 27th, 20:00, in Los Angeles (UTC-7).
    expect(next('2026-10-28T03:00:00Z', 21, 'America/Los_Angeles')).toBe('2026-10-28T04:00:00.000Z');
    expect(next('2026-10-28T03:00:00Z', 8, 'America/Los_Angeles')).toBe('2026-10-28T15:00:00.000Z');
    // India is UTC+5:30.
    expect(next('2026-10-27T00:00:00Z', 8, 'Asia/Kolkata')).toBe('2026-10-27T02:30:00.000Z');
  });

  it('keeps the local hour across daylight-saving changes', () => {
    // Paris leaves summer time on 2026-10-25 (UTC+2 → UTC+1).
    expect(next('2026-10-24T07:00:00Z', 9, 'Europe/Paris')).toBe('2026-10-25T08:00:00.000Z');
    // …and enters it on 2026-03-29 (UTC+1 → UTC+2).
    expect(next('2026-03-28T08:00:00Z', 9, 'Europe/Paris')).toBe('2026-03-29T07:00:00.000Z');
  });

  it('sends an hour the clocks skip one hour later, and a repeated hour once', () => {
    // On 2026-03-29 Paris clocks jump from 02:00 to 03:00: 02:00 arrives at 03:00 local.
    expect(next('2026-03-28T12:00:00Z', 2, 'Europe/Paris')).toBe('2026-03-29T01:00:00.000Z');
    // On 2026-10-25 Paris lives 02:00 to 03:00 twice: one send, on the second 02:00, then the next day.
    const first = next('2026-10-24T12:00:00Z', 2, 'Europe/Paris');
    expect(first).toBe('2026-10-25T01:00:00.000Z');
    expect(next(first, 2, 'Europe/Paris')).toBe('2026-10-26T01:00:00.000Z');
  });
});

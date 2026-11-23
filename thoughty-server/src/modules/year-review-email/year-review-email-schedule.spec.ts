import { DEFAULT_YEAR_REVIEW_EMAIL_HOUR, nextYearlySend, YEAR_REVIEW_EMAIL_SCHEDULE, yearBefore } from './year-review-email-schedule';

const next = (after: string, hour: number, timeZone: string) => nextYearlySend(new Date(after), hour, timeZone).toISOString();

describe('year in review email schedule', () => {
  it('defaults to nine in the morning and keeps one email per local year', () => {
    expect(DEFAULT_YEAR_REVIEW_EMAIL_HOUR).toBe(9);
    expect(YEAR_REVIEW_EMAIL_SCHEDULE.defaultHour).toBe(9);
    expect(YEAR_REVIEW_EMAIL_SCHEDULE.period('2027-01-01')).toBe(YEAR_REVIEW_EMAIL_SCHEDULE.period('2027-12-31'));
    expect(YEAR_REVIEW_EMAIL_SCHEDULE.period('2026-12-31')).not.toBe(YEAR_REVIEW_EMAIL_SCHEDULE.period('2027-01-01'));
    expect(YEAR_REVIEW_EMAIL_SCHEDULE.next).toBe(nextYearlySend);
  });

  it('sends on the coming January 1 at the hour, or later today when it is January 1 and the hour is to come', () => {
    expect(next('2026-11-23T10:00:00Z', 9, 'UTC')).toBe('2027-01-01T09:00:00.000Z');
    expect(next('2027-01-01T08:59:59Z', 9, 'UTC')).toBe('2027-01-01T09:00:00.000Z');
    expect(next('2027-01-01T09:00:00Z', 9, 'UTC')).toBe('2028-01-01T09:00:00.000Z');
    expect(next('2027-06-15T00:00:00Z', 0, 'UTC')).toBe('2028-01-01T00:00:00.000Z');
  });

  it('finds January 1 on the writer’s wall clock, whatever the UTC day', () => {
    // 2026-12-31 20:00 UTC is already 1 January 2027, 05:00, in Tokyo (UTC+9).
    expect(next('2026-12-31T20:00:00Z', 9, 'Asia/Tokyo')).toBe('2027-01-01T00:00:00.000Z');
    // 2027-01-01 03:00 UTC is still 31 December 2026 in Los Angeles (UTC-8).
    expect(next('2027-01-01T03:00:00Z', 9, 'America/Los_Angeles')).toBe('2027-01-01T17:00:00.000Z');
    // Paris is on winter time (UTC+1) in January, wherever summer time is now.
    expect(next('2026-07-01T00:00:00Z', 9, 'Europe/Paris')).toBe('2027-01-01T08:00:00.000Z');
    // India is UTC+5:30.
    expect(next('2026-10-20T00:00:00Z', 9, 'Asia/Kolkata')).toBe('2027-01-01T03:30:00.000Z');
  });

  it('looks back on the year before the local day the email goes out', () => {
    expect(yearBefore('2027-01-01')).toBe(2026);
    expect(yearBefore('2027-01-03')).toBe(2026);
  });
});

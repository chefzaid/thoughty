const DAY_MS = 24 * 60 * 60 * 1000;

/** A day as the web sends it: `YYYY-MM-DD`. */
export const LOCAL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The UTC day of `now`, the fallback when a request does not say which day it is for the writer. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Whether `today` can be the writer's own day at `now`: every time zone's clock is within a day of
 * UTC (from UTC-12 to UTC+14), so their day is the UTC day, the one before or the one after.
 */
export function isWritersDay(today: string, now: Date): boolean {
  return Math.abs(Date.parse(today) - Date.parse(utcDay(now))) <= DAY_MS;
}

/** The writer's day sent with a request (already checked by `@WritersDay()`), or the UTC day without one. */
export function writersDayOr(today: string | undefined, now: Date = new Date()): string {
  return today ?? utcDay(now);
}

/** The year, month (1-12) and day of a valid `YYYY-MM-DD` day. */
export function dayParts(day: string): { year: number; month: number; day: number } {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, day: date };
}

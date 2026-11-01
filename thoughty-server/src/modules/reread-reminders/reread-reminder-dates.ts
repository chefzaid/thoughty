import { earliestOpeningDay, latestOpeningDay } from '@/modules/time-capsules/time-capsule-schedule';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether `today` can be the writer's own day at `now`: every time zone's clock is within a day of
 * UTC (from UTC-12 to UTC+14), so their day is the UTC day, the one before or the one after.
 */
export function isWritersDay(today: string, now: Date): boolean {
  const utcDay = Date.parse(now.toISOString().slice(0, 10));
  return Math.abs(Date.parse(today) - utcDay) <= DAY_MS;
}

/**
 * Whether `rereadOn` is a day a reminder set on `today` can fall on: from tomorrow up to fifty years
 * ahead, the same window a time capsule allows. Both are valid `YYYY-MM-DD` days (the DTO checks them).
 */
export function isRereadDayAllowed(rereadOn: string, today: string): boolean {
  return rereadOn >= earliestOpeningDay(today) && rereadOn <= latestOpeningDay(today);
}

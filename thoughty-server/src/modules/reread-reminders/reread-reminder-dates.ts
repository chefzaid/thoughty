import { earliestOpeningDay, latestOpeningDay } from '@/modules/time-capsules/time-capsule-schedule';

/**
 * Whether `rereadOn` is a day a reminder set on `today` can fall on: from tomorrow up to fifty years
 * ahead, the same window a time capsule allows. Both are valid `YYYY-MM-DD` days (the DTO checks them).
 */
export function isRereadDayAllowed(rereadOn: string, today: string): boolean {
  return rereadOn >= earliestOpeningDay(today) && rereadOn <= latestOpeningDay(today);
}

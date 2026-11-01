import { isValidTimeZone, zonedParts, zonedTimeToUtc } from '@/common/utils/time-zone.util';

export { isValidTimeZone, localDateIn } from '@/common/utils/time-zone.util';

/** The program's saved zone, or UTC for one the runtime no longer knows. */
export function memoirTimeZone(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : 'UTC';
}

/** Weekly memoir questions arrive at this local hour on the writer's chosen weekday. */
export const MEMOIR_DELIVERY_HOUR = 9;

/** The first delivery time strictly after `after`: the given weekday (0 = Sunday) at 09:00 in the zone. */
export function nextWeeklyDelivery(after: Date, weekday: number, timeZone: string): Date {
  const local = zonedParts(after, timeZone);
  const daysAhead = (weekday - local.weekday + 7) % 7;
  const candidate = zonedTimeToUtc(local.year, local.month, local.day + daysAhead, MEMOIR_DELIVERY_HOUR, timeZone);
  if (candidate.getTime() > after.getTime()) {
    return candidate;
  }
  return zonedTimeToUtc(local.year, local.month, local.day + daysAhead + 7, MEMOIR_DELIVERY_HOUR, timeZone);
}

/** "Not this week" sets a question aside for this week and the next three: it comes back with the fourth delivery from now. */
export const MEMOIR_SNOOZE_WEEKS = 4;

/**
 * The writer's day (`YYYY-MM-DD` in the zone) a question set aside at `now` comes back: the local day of
 * the next weekly delivery plus three weeks. Counted on the calendar, so a daylight-saving change never
 * shifts it.
 */
export function memoirSnoozeReturnDay(now: Date, weekday: number, timeZone: string): string {
  const { year, month, day } = zonedParts(nextWeeklyDelivery(now, weekday, timeZone), timeZone);
  return new Date(Date.UTC(year, month - 1, day + (MEMOIR_SNOOZE_WEEKS - 1) * 7)).toISOString().slice(0, 10);
}

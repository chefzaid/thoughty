import { zonedParts, zonedTimeToUtc } from '@/common/utils/time-zone.util';

export { isValidTimeZone, localDateIn } from '@/common/utils/time-zone.util';

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

import { zonedParts, zonedTimeToUtc } from '@/common/utils/time-zone.util';
import type { OptInEmailSchedule } from '@/modules/opt-in-email/opt-in-email-schedule';

/** The local hour the "On this day" email arrives at until the writer picks another. */
export const DEFAULT_ON_THIS_DAY_HOUR = 8;

/**
 * The first time strictly after `after` that the zone's wall clock reads `hour`:00, today or tomorrow.
 * On a daylight-saving change, in every zone, the hour the clocks skip arrives an hour later, and a
 * repeated hour once, on its first occurrence (`zonedTimeToUtc`).
 */
export function nextDailySend(after: Date, hour: number, timeZone: string): Date {
  const local = zonedParts(after, timeZone);
  const today = zonedTimeToUtc(local.year, local.month, local.day, hour, timeZone);
  return today.getTime() > after.getTime()
    ? today
    : zonedTimeToUtc(local.year, local.month, local.day + 1, hour, timeZone);
}

/** Every local day at the chosen hour, at most one email a day. */
export const ON_THIS_DAY_SCHEDULE: OptInEmailSchedule = {
  defaultHour: DEFAULT_ON_THIS_DAY_HOUR,
  next: nextDailySend,
  period: (localDate) => localDate,
};

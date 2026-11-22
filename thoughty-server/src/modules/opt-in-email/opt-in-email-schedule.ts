import { zonedParts, zonedTimeToUtc } from '@/common/utils/time-zone.util';

/** When an opt-in email comes round, and which period of the writer's calendar one email covers. */
export interface OptInEmailSchedule {
  /** The local hour the email arrives at until the writer picks another. */
  readonly defaultHour: number;
  /** The first time strictly after `after` that the email is due at `hour` on the zone's wall clock. */
  next(after: Date, hour: number, timeZone: string): Date;
  /** The period a local day (YYYY-MM-DD) falls in; a period gets at most one email. */
  period(localDate: string): string;
}

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
export function dailySchedule(defaultHour: number): OptInEmailSchedule {
  return { defaultHour, next: nextDailySend, period: (localDate) => localDate };
}

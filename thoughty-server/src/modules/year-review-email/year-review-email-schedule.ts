import { zonedParts, zonedTimeToUtc } from '@/common/utils/time-zone.util';
import type { OptInEmailSchedule } from '@/modules/opt-in-email/opt-in-email-schedule';

/** The local hour the year in review email arrives at until the writer picks another. */
export const DEFAULT_YEAR_REVIEW_EMAIL_HOUR = 9;

/**
 * The first time strictly after `after` that the zone's wall clock reads `hour`:00 on January 1: this
 * year's if that hour is still to come, otherwise next year's. On a daylight-saving change an hour the
 * clocks skip arrives an hour later, and a repeated one on its first occurrence (`zonedTimeToUtc`).
 */
export function nextYearlySend(after: Date, hour: number, timeZone: string): Date {
  const local = zonedParts(after, timeZone);
  const thisYear = zonedTimeToUtc(local.year, 1, 1, hour, timeZone);
  return thisYear.getTime() > after.getTime() ? thisYear : zonedTimeToUtc(local.year + 1, 1, 1, hour, timeZone);
}

/** The year just ended on a local day (YYYY-MM-DD): the one the email sent that day looks back on. */
export function yearBefore(localDate: string): number {
  return Number(localDate.slice(0, 4)) - 1;
}

/** January 1 of every local year at the chosen hour, at most one email a year. */
export const YEAR_REVIEW_EMAIL_SCHEDULE: OptInEmailSchedule = {
  defaultHour: DEFAULT_YEAR_REVIEW_EMAIL_HOUR,
  next: nextYearlySend,
  period: (localDate) => localDate.slice(0, 4),
};

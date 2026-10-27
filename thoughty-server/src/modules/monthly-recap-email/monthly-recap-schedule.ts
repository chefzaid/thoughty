import { zonedParts, zonedTimeToUtc } from '@/common/utils/time-zone.util';
import type { OptInEmailSchedule } from '@/modules/opt-in-email/opt-in-email-schedule';

/** The local hour the monthly recap arrives at until the writer picks another. */
export const DEFAULT_MONTHLY_RECAP_HOUR = 8;

/**
 * The first time strictly after `after` that the zone's wall clock reads `hour`:00 on the 1st of a month:
 * this month's 1st if that hour is still to come, otherwise next month's. Daylight-saving changes are
 * handled as for the daily emails (`zonedTimeToUtc`).
 */
export function nextMonthlySend(after: Date, hour: number, timeZone: string): Date {
  const local = zonedParts(after, timeZone);
  const thisMonth = zonedTimeToUtc(local.year, local.month, 1, hour, timeZone);
  return thisMonth.getTime() > after.getTime()
    ? thisMonth
    : zonedTimeToUtc(local.year, local.month + 1, 1, hour, timeZone);
}

export interface RecapMonth {
  year: number;
  /** 1 to 12. */
  month: number;
}

/** The month just ended on a local day (YYYY-MM-DD): the one the recap sent that day looks back on. */
export function monthBefore(localDate: string): RecapMonth {
  const [year, month] = localDate.split('-').map(Number);
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** The first and last day of a month (YYYY-MM-DD). */
export function monthRange({ year, month }: RecapMonth): { from: string; to: string } {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, '0')}` };
}

/** The 1st of every local month at the chosen hour, at most one email a month. */
export const MONTHLY_RECAP_SCHEDULE: OptInEmailSchedule = {
  defaultHour: DEFAULT_MONTHLY_RECAP_HOUR,
  next: nextMonthlySend,
  period: (localDate) => localDate.slice(0, 7),
};

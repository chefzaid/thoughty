import { isValidTimeZone, localDateIn, zonedTimeToUtc } from '@/common/utils/time-zone.util';

/** The local hour a capsule opens at unless the writer picks another. */
export const DEFAULT_TIME_CAPSULE_HOUR = 9;
/** How far ahead a capsule can be sealed for, in years. */
export const MAX_TIME_CAPSULE_YEARS = 50;

/** When the writer wants a capsule to open: a local day, an hour on it, and the zone of their clock. */
export interface TimeCapsuleRequest {
  /** YYYY-MM-DD in `timeZone`. */
  opensOn: string;
  /** 0 to 23; 9:00 when left out. */
  openHour?: number;
  timeZone: string;
}

export interface TimeCapsuleSchedule {
  opensOn: string;
  openHour: number;
  timeZone: string;
  /** The instant the zone's clock reads `openHour`:00 on `opensOn`. */
  openAt: Date;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseLocalDate(value: string): { year: number; month: number; day: number } | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The first day a capsule sealed on the local day `today` can open on: tomorrow. */
export function earliestOpeningDay(today: string): string {
  const { year, month, day } = parseLocalDate(today)!;
  return isoDay(new Date(Date.UTC(year, month - 1, day + 1)));
}

/** The last day a capsule sealed on `today` can open on: the same day fifty years on (the 28th for a 29 February). */
export function latestOpeningDay(today: string): string {
  const { year, month, day } = parseLocalDate(today)!;
  const latest = new Date(Date.UTC(year + MAX_TIME_CAPSULE_YEARS, month - 1, day));
  if (latest.getUTCMonth() !== month - 1) latest.setUTCDate(0);
  return isoDay(latest);
}

export type TimeCapsuleScheduleError = 'time-zone' | 'date';

/**
 * When a capsule sealed at `now` opens, or why it cannot: the zone must be a known IANA zone, and the
 * day a real date from tomorrow (on the writer's clock) up to fifty years ahead. A daylight-saving
 * change on that day moves a skipped hour later and opens a repeated one at its first occurrence.
 */
export function scheduleTimeCapsule(
  request: TimeCapsuleRequest,
  now: Date,
): { schedule: TimeCapsuleSchedule } | { error: TimeCapsuleScheduleError } {
  if (!isValidTimeZone(request.timeZone)) {
    return { error: 'time-zone' };
  }
  const day = parseLocalDate(request.opensOn);
  const today = localDateIn(now, request.timeZone);
  if (!day || request.opensOn < earliestOpeningDay(today) || request.opensOn > latestOpeningDay(today)) {
    return { error: 'date' };
  }

  const openHour = request.openHour ?? DEFAULT_TIME_CAPSULE_HOUR;
  return {
    schedule: {
      opensOn: request.opensOn,
      openHour,
      timeZone: request.timeZone,
      openAt: zonedTimeToUtc(day.year, day.month, day.day, openHour, request.timeZone),
    },
  };
}

/** Wall-clock arithmetic in IANA time zones, for deliveries that follow the writer's local time. */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday through 6 = Saturday. */
  weekday: number;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date, time and weekday the zone's wall clock shows at `date`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    second: Number(value('second')),
    weekday: WEEKDAYS.indexOf(value('weekday')),
  };
}

/** How far the zone's wall clock is ahead of UTC at `date`. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClockAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant a wall-clock hour occurs in a zone; day overflow rolls into the next month. An hour
 * skipped by a daylight-saving change lands an hour later, and a repeated one on its second occurrence.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour);
  const firstGuess = wallClockAsUtc - zoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  // Re-read the offset at the guess so a daylight-saving change between the two instants is honoured.
  return new Date(wallClockAsUtc - zoneOffsetMs(new Date(firstGuess), timeZone));
}

/** The calendar date (YYYY-MM-DD) it is at `now` in the zone. */
export function localDateIn(now: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(now, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

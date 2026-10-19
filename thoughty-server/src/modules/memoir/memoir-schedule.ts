/** Weekly memoir questions arrive at this local hour on the writer's chosen weekday. */
export const MEMOIR_DELIVERY_HOUR = 9;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
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

function zonedParts(date: Date, timeZone: string): ZonedParts {
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

/** The instant a wall-clock time occurs in a zone; day overflow rolls into the next month. */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour);
  const firstGuess = wallClockAsUtc - zoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  // Re-read the offset at the guess so a daylight-saving change between the two instants is honoured.
  return new Date(wallClockAsUtc - zoneOffsetMs(new Date(firstGuess), timeZone));
}

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


/** The calendar date (YYYY-MM-DD) it is at `now` in the zone, so answers are dated as the writer sees the day. */
export function localDateIn(now: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(now, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

import { localDateIn, zonedParts, zonedTimeToUtc } from '@/common/utils/time-zone.util';
import type { CalendarEvent } from '@/database/entities';
import { repeatDays, type EventRecurrence } from './calendar-recurrence';

/** An occurrence of a repeating event: an all-day one's days (both included), or a timed one's instants. */
export type Occurrence = { startDate: string; endDate: string } | { startsAt: Date; endsAt: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

function startOfDay(date: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return zonedTimeToUtc(year, month, day, 0, timeZone);
}

const earlier = (left: string, right: string) => (left < right ? left : right);

/** The days from `from` to `to` an event first on `first` starts on by its rule (its first day alone without one). */
function ruleDays(recurrence: EventRecurrence, first: string, from: string, to: string): string[] {
  if (recurrence.rule) return to >= from ? repeatDays(recurrence.rule, first, from, to) : [];
  return first >= from && first <= to ? [first] : [];
}

function allDayOccurrence(event: CalendarEvent, recurrence: EventRecurrence, date: string): Occurrence | null {
  const first = event.startDate ?? date;
  const length = daysBetween(first, event.endDate ?? first);
  const from = addDays(date, -length);
  const excluded = new Set(recurrence.exdates);
  const extra = recurrence.rdates.filter((day) => day >= first && day >= from && day <= date);
  const start = [...ruleDays(recurrence, first, from, earlier(recurrence.until ?? date, date)), ...extra]
    .filter((day) => !excluded.has(day))
    .sort()[0];
  return start ? { startDate: start, endDate: addDays(start, length) } : null;
}

function timedOccurrence(event: CalendarEvent, recurrence: EventRecurrence, date: string, timeZone: string): Occurrence | null {
  const firstStart = event.startsAt;
  if (!firstStart) return null;
  const zone = recurrence.timeZone;
  const durationMs = (event.endsAt ?? firstStart).getTime() - firstStart.getTime();
  const dayStart = startOfDay(date, timeZone).getTime();
  const dayEnd = startOfDay(addDays(date, 1), timeZone).getTime();
  const until = recurrence.until ? Date.parse(recurrence.until) : Infinity;
  const clock = zonedParts(firstStart, zone);
  const clockMs = (clock.minute * 60 + clock.second) * 1000;
  const at = (day: string) => {
    const [year, month, dayOfMonth] = day.split('-').map(Number);
    return zonedTimeToUtc(year, month, dayOfMonth, clock.hour, zone).getTime() + clockMs;
  };

  const first = localDateIn(firstStart, zone);
  // A day either side: the writer's and the event's zones need not agree on the date
  const from = addDays(localDateIn(new Date(dayStart - durationMs), zone), -1);
  const to = addDays(localDateIn(new Date(dayEnd), zone), 1);
  const lastRuleDay = Number.isFinite(until) ? localDateIn(new Date(until), zone) : to;
  const excluded = new Set(recurrence.exdates);
  const starts = [
    ...ruleDays(recurrence, first, from, earlier(lastRuleDay, to)).map(at).filter((start) => start <= until),
    ...recurrence.rdates.map(Date.parse).filter((start) => start >= firstStart.getTime()),
  ].filter((start) => {
    const overlaps = start < dayEnd && (start + durationMs > dayStart || start >= dayStart);
    return overlaps && !excluded.has(new Date(start).toISOString()) && !excluded.has(localDateIn(new Date(start), zone));
  });
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  return { startsAt: new Date(start), endsAt: new Date(start + durationMs) };
}

/**
 * The first occurrence of a repeating event that falls on `date` in `timeZone`, the writer's: an all-day
 * occurrence whose days include it, or a timed one that overlaps it (one without a length when it
 * starts that day), as the day's one-off events are listed. A timed event repeats at its first start's
 * wall-clock time in its own zone, across daylight-saving changes.
 */
export function occurrenceOn(event: CalendarEvent, date: string, timeZone: string): Occurrence | null {
  const recurrence = event.recurrence;
  if (!recurrence) return null;
  return event.allDay ? allDayOccurrence(event, recurrence, date) : timedOccurrence(event, recurrence, date, timeZone);
}

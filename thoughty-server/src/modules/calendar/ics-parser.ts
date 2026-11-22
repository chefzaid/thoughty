import { createHash } from 'crypto';
import { isValidTimeZone, localDateIn, zonedTimeToUtc } from '@/common/utils/time-zone.util';
import { parseRrule, type EventRecurrence } from './calendar-recurrence';

export const CALENDAR_TEXT_MAX_LENGTH = 200;
const UID_MAX_LENGTH = 255;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The most extra or removed occurrences (`RDATE`, `EXDATE`) a repeating event keeps; one with more is not imported. */
export const RECURRENCE_DATES_MAX = 1000;

interface ParsedEventBase {
  uid: string;
  summary: string;
  location: string | null;
  /** How the event repeats; null for a one-off event. */
  recurrence: EventRecurrence | null;
}

/** An all-day event's first and last days (`YYYY-MM-DD`), both included. */
export interface ParsedAllDayEvent extends ParsedEventBase {
  allDay: true;
  startDate: string;
  endDate: string;
}

export interface ParsedTimedEvent extends ParsedEventBase {
  allDay: false;
  startsAt: Date;
  endsAt: Date;
}

export type ParsedCalendarEvent = ParsedAllDayEvent | ParsedTimedEvent;

export interface ParsedCalendar {
  events: ParsedCalendarEvent[];
  /** Repeating events whose rule cannot be read (hourly, by week number…), which are not imported. */
  skippedRecurring: number;
}

interface Property {
  params: Map<string, string>;
  value: string;
}

type Properties = Map<string, Property[]>;

/** A `VEVENT` read: the event (none for a cancelled one), the repeating event's occurrence it replaces, or a rule that cannot be read. */
type ReadEvent =
  | { event: ParsedCalendarEvent | null; replaces: { uid: string; start: string | Date } | null }
  | 'unreadable-repeat';

/**
 * Reads the events of an iCalendar file (RFC 5545), as calendar apps export them. Each `VEVENT` with a
 * start becomes one event; cancelled ones are left out. A repeating event keeps its rule, and each of
 * its changed occurrences (`RECURRENCE-ID`) becomes an event of its own, removed from the rule's
 * occurrences (a cancelled one is only removed). A time with a `TZID` that is an IANA zone is read in
 * it; a floating time, or one whose `TZID` is not an IANA name (Outlook's "Romance Standard Time"), in
 * `timeZone`, the writer's. Returns null when the text is not a calendar.
 */
export function parseIcs(text: string, timeZone: string): ParsedCalendar | null {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  if (!lines.some((line) => line.trim().toUpperCase() === 'BEGIN:VCALENDAR')) return null;

  const events = new Map<string, ParsedCalendarEvent>();
  const replaced: { uid: string; start: string | Date }[] = [];
  let skippedRecurring = 0;
  let current: Properties | null = null;
  let nested = 0;
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = new Map();
      nested = 0;
    } else if (current && upper === 'END:VEVENT') {
      const read = readEvent(current, timeZone);
      if (read === 'unreadable-repeat') skippedRecurring += 1;
      else {
        if (read.event) events.set(read.event.uid, read.event);
        if (read.replaces) replaced.push(read.replaces);
      }
      current = null;
    } else if (current && upper.startsWith('BEGIN:')) {
      nested += 1;
    } else if (current && upper.startsWith('END:')) {
      nested -= 1;
    } else if (current && nested === 0) {
      const property = parseProperty(line);
      if (property) current.set(property.name, [...(current.get(property.name) ?? []), property]);
    }
  }
  for (const { uid, start } of replaced) {
    const master = events.get(uid);
    if (master?.recurrence) master.recurrence.exdates.push(...recurrenceValues([start], master.allDay, master.recurrence.timeZone));
  }
  return { events: [...events.values()], skippedRecurring };
}

/** `NAME;PARAM=value;PARAM="quoted:value":VALUE`: the value starts at the first colon outside quotes. */
function parseProperty(line: string): (Property & { name: string }) | null {
  let quoted = false;
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === ';' || char === ':')) {
      parts.push(line.slice(start, index));
      start = index + 1;
      if (char === ':') {
        const [name, ...params] = parts;
        return {
          name: name.trim().toUpperCase(),
          params: new Map(params.map((param) => {
            const [key, ...rest] = param.split('=');
            return [key.trim().toUpperCase(), rest.join('=').replace(/^"|"$/g, '')] as const;
          })),
          value: line.slice(start),
        };
      }
    }
  }
  return null;
}

function readEvent(properties: Properties, timeZone: string): ReadEvent {
  const property = (name: string) => properties.get(name)?.[0];
  const dtStart = property('DTSTART');
  const recurrenceId = property('RECURRENCE-ID');
  const ownUid = property('UID')?.value.trim();
  const original = recurrenceId ? readDateValue(recurrenceId, timeZone) : null;
  const replaces = ownUid && original ? { uid: eventUid(ownUid, ownUid), start: original } : null;
  if (!dtStart || property('STATUS')?.value.trim().toUpperCase() === 'CANCELLED') return { event: null, replaces };

  const summary = cleanText(property('SUMMARY')?.value) ?? '';
  const location = cleanText(property('LOCATION')?.value);
  const uid = eventUid(recurrenceId && ownUid ? `${ownUid}|${recurrenceId.value.trim()}` : ownUid, `${summary}|${dtStart.value}`);
  const event = toEvent({ uid, summary, location, recurrence: null }, properties, timeZone);
  if (!event) return { event: null, replaces };
  if (recurrenceId || (!properties.has('RRULE') && !properties.has('RDATE'))) return { event, replaces };

  const recurrence = readRecurrence(properties, event, zoneOf(dtStart, timeZone));
  return recurrence ? { event: { ...event, recurrence }, replaces: null } : 'unreadable-repeat';
}

function toEvent(base: ParsedEventBase, properties: Properties, timeZone: string): ParsedCalendarEvent | null {
  const dtStart = properties.get('DTSTART')?.[0];
  const start = dtStart ? readDateValue(dtStart, timeZone) : null;
  if (!start) return null;
  const end = properties.get('DTEND')?.[0];
  const duration = properties.get('DURATION')?.[0];
  const durationMs = duration ? parseDuration(duration.value.trim()) : null;

  if (typeof start === 'string') {
    const exclusiveEnd = end ? readDateValue(end, timeZone) : null;
    let lastDay = start;
    if (typeof exclusiveEnd === 'string') lastDay = addDays(exclusiveEnd, -1);
    else if (durationMs) lastDay = addDays(start, Math.ceil(durationMs / DAY_MS) - 1);
    return { ...base, allDay: true, startDate: start, endDate: lastDay < start ? start : lastDay };
  }
  const endValue = end ? readDateValue(end, timeZone) : null;
  let endsAt = start;
  if (endValue instanceof Date) endsAt = endValue;
  else if (durationMs) endsAt = new Date(start.getTime() + durationMs);
  return { ...base, allDay: false, startsAt: start, endsAt: endsAt < start ? start : endsAt };
}

/**
 * How a repeating event repeats, its days and instants as `EventRecurrence` keeps them; null when its
 * rule cannot be read, it has more than one rule, or too many extra or removed occurrences.
 */
function readRecurrence(properties: Properties, event: ParsedCalendarEvent, zone: string): EventRecurrence | null {
  const rules = properties.get('RRULE') ?? [];
  const parsed = rules.length === 1 ? parseRrule(rules[0].value) : null;
  if (rules.length > 1 || (rules.length === 1 && !parsed)) return null;
  const listed = (name: string) => (properties.get(name) ?? []).flatMap((property) =>
    property.value.split(',').map((value) => readDateValue({ params: property.params, value }, zone)));
  const rdates = listed('RDATE');
  const exdates = listed('EXDATE');
  if (rdates.length > RECURRENCE_DATES_MAX || exdates.length > RECURRENCE_DATES_MAX) return null;

  let until: string | null = null;
  if (parsed?.until) {
    const value = readDateValue({ params: new Map(), value: parsed.until }, zone);
    if (!value) return null;
    until = lastStart(value, event, zone);
  }
  return {
    rule: parsed?.rule ?? null,
    until,
    // A timed event's extra starts are instants: a day alone gives no time
    rdates: recurrenceValues(rdates, event.allDay, zone).filter((value) => event.allDay || value.length > 10),
    exdates: recurrenceValues(exdates, event.allDay, zone),
    timeZone: zone,
  };
}

/** `UNTIL` as the last day an all-day event repeats on, or the last instant a timed one starts at. */
function lastStart(value: string | Date, event: ParsedCalendarEvent, zone: string): string {
  if (event.allDay) return typeof value === 'string' ? value : localDateIn(value, zone);
  if (value instanceof Date) return value.toISOString();
  const [year, month, day] = addDays(value, 1).split('-').map(Number);
  return new Date(zonedTimeToUtc(year, month, day, 0, zone).getTime() - 1).toISOString();
}

/** Occurrence dates as a repeating event keeps them: days for an all-day event, instants (or days) for a timed one. */
function recurrenceValues(values: (string | Date | null)[], allDay: boolean, zone: string): string[] {
  return values.flatMap((value) => {
    if (value === null) return [];
    if (typeof value === 'string') return [value];
    return [allDay ? localDateIn(value, zone) : value.toISOString()];
  });
}

/** The zone a time is read in: UTC for a `Z` time, its `TZID` when that is an IANA zone, else the writer's. */
function zoneOf(property: Property, timeZone: string): string {
  if (property.value.trim().toUpperCase().endsWith('Z')) return 'UTC';
  const tzid = property.params.get('TZID')?.replace(/^\//, '').trim();
  return tzid && isValidTimeZone(tzid) ? tzid : timeZone;
}

/** The event's own `UID`, or a stable one made from its title and start; a long one is hashed to fit. */
function eventUid(uid: string | undefined, fallback: string): string {
  if (uid && uid.length <= UID_MAX_LENGTH) return uid;
  return `sha256:${createHash('sha256').update(uid || fallback).digest('hex')}`;
}

/** Unescapes RFC 5545 text, on one line, cut to the column's length; null when empty. */
function cleanText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const text = value
    .replace(/\\([\\;,nN])/g, (_match, char: string) => (char === 'n' || char === 'N' ? ' ' : char))
    .replace(/\s+/g, ' ')
    .trim();
  return text ? [...text].slice(0, CALENDAR_TEXT_MAX_LENGTH).join('') : null;
}

const DATE_VALUE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME_VALUE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

/** A `DATE` as `YYYY-MM-DD`, a `DATE-TIME` as its instant, or null when it is not a real one. */
function readDateValue(property: Property, timeZone: string): string | Date | null {
  const value = property.value.trim().toUpperCase();
  const dateOnly = DATE_VALUE.exec(value);
  if (dateOnly) return realDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]));

  const dateTime = DATE_TIME_VALUE.exec(value);
  if (!dateTime) return null;
  const [year, month, day, hour, minute, second] = dateTime.slice(1, 7).map(Number);
  if (!realDate(year, month, day) || hour > 23 || minute > 59 || second > 60) return null;
  if (dateTime[7] === 'Z') return new Date(Date.UTC(year, month - 1, day, hour, minute, Math.min(second, 59)));

  const zone = zoneOf(property, timeZone);
  const hourStart = zonedTimeToUtc(year, month, day, hour, zone);
  return new Date(hourStart.getTime() + (minute * 60 + Math.min(second, 59)) * 1000);
}

function realDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const DURATION_VALUE = /^\+?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;

/** A positive `DURATION` (`P1D`, `PT1H30M`, `P2W`) in milliseconds, or null. */
function parseDuration(value: string): number | null {
  const match = DURATION_VALUE.exec(value);
  if (!match) return null;
  const [weeks, days, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0));
  const ms = ((((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return ms > 0 ? ms : null;
}

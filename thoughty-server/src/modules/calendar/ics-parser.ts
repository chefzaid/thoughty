import { createHash } from 'crypto';
import { isValidTimeZone, zonedTimeToUtc } from '@/common/utils/time-zone.util';

export const CALENDAR_TEXT_MAX_LENGTH = 200;
const UID_MAX_LENGTH = 255;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ParsedEventBase {
  uid: string;
  summary: string;
  location: string | null;
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
  /** Repeating events (`RRULE` or `RDATE`), which are not imported. */
  skippedRecurring: number;
}

interface Property {
  params: Map<string, string>;
  value: string;
}

/**
 * Reads the events of an iCalendar file (RFC 5545), as calendar apps export them. Each `VEVENT` with a
 * start becomes one event; cancelled ones and the changed occurrences of a repeating event are left
 * out, and repeating events are counted, not imported. A time with a `TZID` that is an IANA zone is
 * read in it; a floating time, or one whose `TZID` is not an IANA name (Outlook's "Romance Standard
 * Time"), in `timeZone`, the writer's. Returns null when the text is not a calendar.
 */
export function parseIcs(text: string, timeZone: string): ParsedCalendar | null {
  const lines = text.replace(/^﻿/, '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  if (!lines.some((line) => line.trim().toUpperCase() === 'BEGIN:VCALENDAR')) return null;

  const events = new Map<string, ParsedCalendarEvent>();
  let skippedRecurring = 0;
  let current: Map<string, Property> | null = null;
  let nested = 0;
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = new Map();
      nested = 0;
    } else if (current && upper === 'END:VEVENT') {
      if (current.has('RRULE') || current.has('RDATE')) skippedRecurring += 1;
      const event = toEvent(current, timeZone);
      if (event) events.set(event.uid, event);
      current = null;
    } else if (current && upper.startsWith('BEGIN:')) {
      nested += 1;
    } else if (current && upper.startsWith('END:')) {
      nested -= 1;
    } else if (current && nested === 0) {
      const property = parseProperty(line);
      if (property && !current.has(property.name)) current.set(property.name, property);
    }
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

function toEvent(properties: Map<string, Property>, timeZone: string): ParsedCalendarEvent | null {
  const dtStart = properties.get('DTSTART');
  if (!dtStart || properties.has('RRULE') || properties.has('RDATE') || properties.has('RECURRENCE-ID')) return null;
  if (properties.get('STATUS')?.value.trim().toUpperCase() === 'CANCELLED') return null;

  const summary = cleanText(properties.get('SUMMARY')?.value) ?? '';
  const location = cleanText(properties.get('LOCATION')?.value);
  const uid = eventUid(properties.get('UID')?.value.trim(), `${summary}|${dtStart.value}`);
  const start = readDateValue(dtStart, timeZone);
  if (!start) return null;
  const end = properties.get('DTEND');
  const duration = properties.get('DURATION');
  const durationMs = duration ? parseDuration(duration.value.trim()) : null;

  if (typeof start === 'string') {
    const exclusiveEnd = end ? readDateValue(end, timeZone) : null;
    let lastDay = start;
    if (typeof exclusiveEnd === 'string') lastDay = addDays(exclusiveEnd, -1);
    else if (durationMs) lastDay = addDays(start, Math.ceil(durationMs / DAY_MS) - 1);
    return { uid, summary, location, allDay: true, startDate: start, endDate: lastDay < start ? start : lastDay };
  }
  const endValue = end ? readDateValue(end, timeZone) : null;
  let endsAt = start;
  if (endValue instanceof Date) endsAt = endValue;
  else if (durationMs) endsAt = new Date(start.getTime() + durationMs);
  return { uid, summary, location, allDay: false, startsAt: start, endsAt: endsAt < start ? start : endsAt };
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

  const tzid = property.params.get('TZID')?.replace(/^\//, '').trim();
  const zone = tzid && isValidTimeZone(tzid) ? tzid : timeZone;
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

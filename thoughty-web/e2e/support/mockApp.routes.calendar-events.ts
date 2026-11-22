import type { components } from '../../src/generated/openapi';
import type { MockAppState } from './mockApp.shared';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';
import { filePart } from './mockApp.routes.attachments';

type CalendarEventDto = components['schemas']['CalendarEventResponseDto'];

/** A simple rule (`FREQ` and `INTERVAL` alone), the only kind the specs' repeating events use. */
interface MockRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
}

export type MockCalendarEvent = CalendarEventDto & { uid: string; rule?: MockRule };

const MOCK_CALENDAR_EVENT_LIMIT = 10000;
const DAY_MS = 86_400_000;

function readMockRule(value: string | undefined): MockRule | null {
  const match = /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(?:;INTERVAL=(\d+))?$/.exec(value ?? '');
  return match ? { freq: match[1] as MockRule['freq'], interval: Number(match[2] ?? 1) } : null;
}

/** `YYYYMMDD` as `YYYY-MM-DD`, or `YYYYMMDDTHHMMSSZ` as its instant: the forms the specs' files use. */
function icsValue(value: string): string | Date | null {
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (date) return `${date[1]}-${date[2]}-${date[3]}`;
  const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  return time ? new Date(`${time[1]}-${time[2]}-${time[3]}T${time[4]}:${time[5]}:${time[6]}Z`) : null;
}

/**
 * A short calendar file read as `parseIcs` reads it, for UTC times and all-day dates; repeating events
 * with a simple rule are kept, the others counted.
 */
function readMockIcs(text: string): { events: Omit<MockCalendarEvent, 'id'>[]; skippedRecurring: number } | null {
  if (!/^BEGIN:VCALENDAR$/m.test(text)) return null;
  const blocks = text.split(/BEGIN:VEVENT\r?\n/).slice(1).map((block) => block.split(/\r?\nEND:VEVENT/)[0] ?? '');
  const field = (block: string, name: string) => new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, 'm').exec(block)?.[1]?.trim();
  const unreadable = blocks.filter((block) => field(block, 'RRULE') && !readMockRule(field(block, 'RRULE')));
  const events = blocks.filter((block) => !unreadable.includes(block)).flatMap((block): Omit<MockCalendarEvent, 'id'>[] => {
    const start = icsValue(field(block, 'DTSTART') ?? '');
    if (!start) return [];
    const end = icsValue(field(block, 'DTEND') ?? '');
    const rule = readMockRule(field(block, 'RRULE'));
    const base = {
      uid: field(block, 'UID') ?? String(start),
      summary: field(block, 'SUMMARY') ?? '',
      location: field(block, 'LOCATION') ?? null,
      repeats: rule !== null,
      ...(rule ? { rule } : {}),
    };
    if (typeof start === 'string') {
      const lastDay = typeof end === 'string' ? new Date(Date.parse(`${end}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : start;
      return [{ ...base, allDay: true, startsAt: null, endsAt: null, startDate: start, endDate: lastDay < start ? start : lastDay }];
    }
    const endsAt = end instanceof Date && end > start ? end : start;
    return [{ ...base, allDay: false, startsAt: start.toISOString(), endsAt: endsAt.toISOString(), startDate: null, endDate: null }];
  });
  return { events, skippedRecurring: unreadable.length };
}

/** The day (`YYYY-MM-DD`) an instant falls on in a time zone. */
const dayIn = (instant: string, timeZone: string) => new Date(instant).toLocaleDateString('en-CA', { timeZone });
const dayMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Whether a simple rule first on `first` repeats on `day` (UTC days). */
function repeatsOn(rule: MockRule, first: string, day: string): boolean {
  const days = Math.round((dayMs(day) - dayMs(first)) / DAY_MS);
  const [firstYear, firstMonth, firstDay] = first.split('-').map(Number) as [number, number, number];
  const [year, month, dayOfMonth] = day.split('-').map(Number) as [number, number, number];
  const months = (year - firstYear) * 12 + month - firstMonth;
  if (days < 0) return false;
  if (rule.freq === 'DAILY') return days % rule.interval === 0;
  if (rule.freq === 'WEEKLY') return days % (7 * rule.interval) === 0;
  if (rule.freq === 'MONTHLY') return dayOfMonth === firstDay && months % rule.interval === 0;
  return dayOfMonth === firstDay && month === firstMonth && (year - firstYear) % rule.interval === 0;
}

/** The event (a repeating one at its first occurrence on the day) if it falls on `date` in `timeZone`. */
function onDay(event: MockCalendarEvent, date: string, timeZone: string): CalendarEventDto | null {
  const { uid: _uid, rule, ...dto } = event;
  if (event.allDay) {
    const length = Math.round((dayMs(event.endDate ?? '') - dayMs(event.startDate ?? '')) / DAY_MS);
    for (let back = length; back >= 0 && rule; back -= 1) {
      const start = new Date(dayMs(date) - back * DAY_MS).toISOString().slice(0, 10);
      if (repeatsOn(rule, event.startDate ?? '', start)) {
        return { ...dto, startDate: start, endDate: new Date(dayMs(start) + length * DAY_MS).toISOString().slice(0, 10) };
      }
    }
    return !rule && (event.startDate ?? '') <= date && date <= (event.endDate ?? '') ? dto : null;
  }
  const firstStart = Date.parse(event.startsAt ?? '');
  const duration = Date.parse(event.endsAt ?? '') - firstStart;
  const first = new Date(firstStart).toISOString().slice(0, 10);
  const starts = rule
    ? [-2, -1, 0, 1].map((offset) => dayMs(date) + offset * DAY_MS)
      .filter((day) => repeatsOn(rule, first, new Date(day).toISOString().slice(0, 10)))
      .map((day) => day + firstStart - dayMs(first))
    : [firstStart];
  for (const start of starts) {
    const startsAt = new Date(start).toISOString();
    const endsAt = new Date(start + duration).toISOString();
    if (dayIn(startsAt, timeZone) <= date && date <= dayIn(endsAt, timeZone)) return { ...dto, startsAt, endsAt };
  }
  return null;
}

function eventsOn(state: MockAppState, date: string, timeZone: string): CalendarEventDto[] {
  return state.calendarEvents
    .flatMap((event) => onDay(event, date, timeZone) ?? [])
    .sort((left, right) => Number(right.allDay) - Number(left.allDay) || (left.startsAt ?? '').localeCompare(right.startsAt ?? ''));
}

/** `/api/calendar` as the API answers it: a file imported by UID, the events of a day (or of several) in the writer's zone, and removing them all. */
export async function handleCalendarEventRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/calendar' && request.method() === 'GET') {
    const lastImportedAt = state.calendarEvents.length ? state.calendarImportedAt : null;
    await fulfillJson(route, { eventCount: state.calendarEvents.length, lastImportedAt, limit: MOCK_CALENDAR_EVENT_LIMIT });
    return true;
  }
  if (pathname === '/api/calendar/events' && request.method() === 'GET') {
    await fulfillJson(route, { events: eventsOn(state, searchParams.get('date') ?? '', searchParams.get('timeZone') ?? 'UTC') });
    return true;
  }
  if (pathname === '/api/calendar/days' && request.method() === 'GET') {
    const timeZone = searchParams.get('timeZone') ?? 'UTC';
    const dates = [...new Set((searchParams.get('dates') ?? '').split(','))].sort();
    const days = dates.flatMap((date) => {
      const events = eventsOn(state, date, timeZone);
      return events.length > 0 ? [{ date, events }] : [];
    });
    await fulfillJson(route, { days });
    return true;
  }
  if (pathname === '/api/calendar/import' && request.method() === 'POST') {
    const file = filePart(request);
    const calendar = file ? readMockIcs(file.body.toString('utf8')) : null;
    if (!calendar) {
      await fulfillApiError(route, 400, 'CALENDAR_FILE_INVALID', 'This file is not a calendar (.ics)');
      return true;
    }
    for (const event of calendar.events) {
      const existing = state.calendarEvents.find((candidate) => candidate.uid === event.uid);
      if (existing) Object.assign(existing, event);
      else state.calendarEvents.push({ ...event, id: state.calendarEvents.reduce((max, candidate) => Math.max(max, candidate.id), 0) + 1 });
    }
    state.calendarImportedAt = new Date().toISOString();
    await fulfillJson(route, { imported: calendar.events.length, skippedRecurring: calendar.skippedRecurring, eventCount: state.calendarEvents.length }, { status: 201 });
    return true;
  }
  if (pathname === '/api/calendar' && request.method() === 'DELETE') {
    state.calendarEvents = [];
    await fulfillJson(route, { success: true });
    return true;
  }
  return false;
}

import type { components } from '../../src/generated/openapi';
import type { MockAppState } from './mockApp.shared';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';
import { filePart } from './mockApp.routes.attachments';

export type MockCalendarEvent = components['schemas']['CalendarEventResponseDto'] & { uid: string };

const MOCK_CALENDAR_EVENT_LIMIT = 10000;

/** `YYYYMMDD` as `YYYY-MM-DD`, or `YYYYMMDDTHHMMSSZ` as its instant: the forms the specs' files use. */
function icsValue(value: string): string | Date | null {
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (date) return `${date[1]}-${date[2]}-${date[3]}`;
  const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  return time ? new Date(`${time[1]}-${time[2]}-${time[3]}T${time[4]}:${time[5]}:${time[6]}Z`) : null;
}

/** A short calendar file read as `parseIcs` reads it, for UTC times and all-day dates; repeating events are counted. */
function readMockIcs(text: string): { events: Omit<MockCalendarEvent, 'id'>[]; skippedRecurring: number } | null {
  if (!/^BEGIN:VCALENDAR$/m.test(text)) return null;
  const blocks = text.split(/BEGIN:VEVENT\r?\n/).slice(1).map((block) => block.split(/\r?\nEND:VEVENT/)[0] ?? '');
  const field = (block: string, name: string) => new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, 'm').exec(block)?.[1]?.trim();
  const recurring = blocks.filter((block) => field(block, 'RRULE'));
  const events = blocks.filter((block) => !field(block, 'RRULE')).flatMap((block): Omit<MockCalendarEvent, 'id'>[] => {
    const start = icsValue(field(block, 'DTSTART') ?? '');
    if (!start) return [];
    const end = icsValue(field(block, 'DTEND') ?? '');
    const base = { uid: field(block, 'UID') ?? String(start), summary: field(block, 'SUMMARY') ?? '', location: field(block, 'LOCATION') ?? null };
    if (typeof start === 'string') {
      const lastDay = typeof end === 'string' ? new Date(Date.parse(`${end}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : start;
      return [{ ...base, allDay: true, startsAt: null, endsAt: null, startDate: start, endDate: lastDay < start ? start : lastDay }];
    }
    const endsAt = end instanceof Date && end > start ? end : start;
    return [{ ...base, allDay: false, startsAt: start.toISOString(), endsAt: endsAt.toISOString(), startDate: null, endDate: null }];
  });
  return { events, skippedRecurring: recurring.length };
}

/** The day (`YYYY-MM-DD`) an instant falls on in a time zone. */
const dayIn = (instant: string, timeZone: string) => new Date(instant).toLocaleDateString('en-CA', { timeZone });

function eventsOn(state: MockAppState, date: string, timeZone: string): components['schemas']['CalendarEventResponseDto'][] {
  return state.calendarEvents
    .filter((event) => (event.allDay
      ? (event.startDate ?? '') <= date && date <= (event.endDate ?? '')
      : dayIn(event.startsAt ?? '', timeZone) <= date && date <= dayIn(event.endsAt ?? '', timeZone)))
    .sort((left, right) => Number(right.allDay) - Number(left.allDay) || (left.startsAt ?? '').localeCompare(right.startsAt ?? ''))
    .map(({ uid: _uid, ...event }) => event);
}

/** `/api/calendar` as the API answers it: a file imported by UID, the events of a day in the writer's zone, and removing them all. */
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

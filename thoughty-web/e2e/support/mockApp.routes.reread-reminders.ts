import type { components } from '../../src/generated/openapi';

import type { MockAppState, MockEntry } from './mockApp.shared';
import { fulfillApiError, fulfillJson, toEntryMutationResponse, toEntryResponse, type RouteContext } from './mockApp.route-utils';
import { isMockSealed } from './mockApp.routes.time-capsules';

/** Reminders Highlights shows at most, as the API does. */
const HIGHLIGHT_LIMIT = 10;

/** The day `years` after `day` (YYYY-MM-DD), the 28th for a 29 February, as the API reckons fifty years ahead. */
function yearsAfter(day: string, years: number): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const later = new Date(Date.UTC(year + years, month - 1, date));
  if (later.getUTCMonth() !== month - 1) later.setUTCDate(0);
  return later.toISOString().slice(0, 10);
}

function dayAfter(day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}

/** Highlights' entries due to be reread by the writer's day, longest waiting first. */
export function mockDueRereads(entries: MockEntry[], today: string, state: MockAppState): Array<components['schemas']['EntryResponseDto']> {
  return entries
    .filter((entry) => entry.rereadOn && entry.rereadOn <= today && !isMockSealed(entry))
    .sort((left, right) => left.rereadOn!.localeCompare(right.rereadOn!) || left.id - right.id)
    .slice(0, HIGHLIGHT_LIMIT)
    .map((entry) => toEntryResponse(entry, state));
}

/** `PUT` and `DELETE /api/entries/:id/reread-reminder`: one reminder per entry, from tomorrow up to fifty years ahead. */
export async function handleRereadReminderRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const match = /^\/api\/entries\/(\d+)\/reread-reminder$/.exec(pathname);
  if (!match || !['PUT', 'DELETE'].includes(request.method())) return false;

  const entryId = Number(match[1]);
  const entry = state.entries.find((candidate) => candidate.id === entryId);
  if (!entry) {
    await fulfillApiError(route, 404, 'ENTRY_NOT_FOUND', 'Entry not found');
    return true;
  }
  if (isMockSealed(entry)) {
    await fulfillApiError(route, 409, 'ENTRY_SEALED', 'This entry is sealed as a time capsule until it opens');
    return true;
  }
  if (request.method() === 'DELETE') {
    entry.rereadOn = null;
    await fulfillJson(route, toEntryMutationResponse(state, entryId));
    return true;
  }

  const { rereadOn, today } = request.postDataJSON() as components['schemas']['SetRereadReminderDto'];
  if (rereadOn < dayAfter(today) || rereadOn > yearsAfter(today, 50)) {
    await fulfillApiError(route, 400, 'REREAD_DATE_INVALID', 'Choose a day to reread it from tomorrow up to 50 years ahead');
    return true;
  }
  entry.rereadOn = rereadOn;
  await fulfillJson(route, toEntryMutationResponse(state, entryId));
  return true;
}

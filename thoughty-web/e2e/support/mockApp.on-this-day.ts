import type { components } from '../../src/generated/openapi';
import { sortEntries, type MockAppState, type MockEntry } from './mockApp.shared';
import { toEntryResponse } from './mockApp.route-utils';
import { isMockSealed } from './mockApp.routes.time-capsules';

/** Entries On This Day shows at most, as the API does. */
const ON_THIS_DAY_LIMIT = 10;

type EntryResponse = components['schemas']['EntryResponseDto'];

/**
 * Highlights' On This Day as the API answers it for the writer's day `today` (YYYY-MM-DD): the entries
 * of earlier years dated on its month and day, newest first, grouped by how many years ago; sealed
 * time capsules never count.
 */
export function mockOnThisDay(entries: MockEntry[], today: string, state: MockAppState): Record<string, EntryResponse[]> {
  const year = Number(today.slice(0, 4));
  const groups: Record<string, EntryResponse[]> = {};
  sortEntries(entries)
    .filter((entry) => entry.date.slice(5) === today.slice(5) && Number(entry.date.slice(0, 4)) < year && !isMockSealed(entry))
    .slice(0, ON_THIS_DAY_LIMIT)
    .forEach((entry) => {
      const yearsAgo = String(year - Number(entry.date.slice(0, 4)));
      (groups[yearsAgo] ??= []).push(toEntryResponse(entry, state));
    });
  return groups;
}

/** `currentDate` in Highlights: the writer's day `today` split into its parts. */
export function mockCurrentDate(today: string): { month: string; day: string; year: number } {
  return { month: today.slice(5, 7), day: today.slice(8, 10), year: Number(today.slice(0, 4)) };
}

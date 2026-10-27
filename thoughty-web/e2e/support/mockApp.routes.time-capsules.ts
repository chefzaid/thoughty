import type { components } from '../../src/generated/openapi';

import type { MockAppState, MockEntry } from './mockApp.shared';
import { fulfillApiError, fulfillJson, toEntryMutationResponse, toEntryResponse, type RouteContext } from './mockApp.route-utils';

/** Days Highlights shows a capsule after it opens, as the API does. */
const OPENED_HIGHLIGHT_MS = 7 * 24 * 60 * 60 * 1000;

/** Whether the entry is a time capsule still sealed. */
export function isMockSealed(entry: Pick<MockEntry, 'capsule'>): boolean {
  return Boolean(entry.capsule && !entry.capsule.openedAt);
}

/**
 * The capsule a new entry gets from the composer's `seal`, kept private as the API keeps it. The mock opens it
 * at the hour on the UTC clock; the API reads the writer's zone (its own specs cover the time zones).
 */
export function mockSeal(seal: { opensOn: string; openHour?: number } | undefined): Partial<Pick<MockEntry, 'capsule' | 'visibility'>> {
  if (!seal) return {};
  const hour = String(seal.openHour ?? 9).padStart(2, '0');
  return {
    visibility: 'private',
    capsule: { openAt: new Date(`${seal.opensOn}T${hour}:00:00Z`).toISOString(), sealedAt: new Date().toISOString(), openedAt: null },
  };
}

/** Highlights' capsules opened in the last week, newest first. */
export function mockOpenedCapsules(entries: MockEntry[], state: MockAppState): Array<components['schemas']['OpenedTimeCapsuleDto']> {
  const since = Date.now() - OPENED_HIGHLIGHT_MS;
  return entries
    .filter((entry) => entry.capsule?.openedAt && new Date(entry.capsule.openedAt).getTime() >= since)
    .sort((left, right) => right.capsule!.openedAt!.localeCompare(left.capsule!.openedAt!))
    .map((entry) => ({
      entry: toEntryResponse(entry, state),
      sealed_at: entry.capsule!.sealedAt,
      opened_at: entry.capsule!.openedAt!,
      opened_early: entry.capsule!.openedAt! < entry.capsule!.openAt,
    }));
}

/** `POST /api/entries/:id/unseal`, and the edits a sealed entry refuses. */
export async function handleTimeCapsuleRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const unseal = /^\/api\/entries\/(\d+)\/unseal$/.exec(pathname);
  const edit = /^\/api\/entries\/(\d+)(?:\/visibility|\/tasks)?$/.exec(pathname);
  const entryId = Number((unseal ?? edit)?.[1]);
  const entry = state.entries.find((candidate) => candidate.id === entryId);

  if (unseal && request.method() === 'POST') {
    if (!entry) {
      await fulfillApiError(route, 404, 'ENTRY_NOT_FOUND', 'Entry not found');
    } else if (!isMockSealed(entry)) {
      await fulfillApiError(route, 409, 'ENTRY_NOT_SEALED', 'This entry is not sealed');
    } else {
      entry.capsule = { ...entry.capsule!, openedAt: new Date().toISOString() };
      await fulfillJson(route, toEntryMutationResponse(state, entryId), { status: 201 });
    }
    return true;
  }

  if (edit && entry && isMockSealed(entry) && ['PUT', 'PATCH'].includes(request.method())) {
    await fulfillApiError(route, 409, 'ENTRY_SEALED', 'This entry is sealed as a time capsule until it opens');
    return true;
  }
  return false;
}

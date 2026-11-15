import { getFilteredEntries } from './mockApp.routes.entries';
import { isMockSealed } from './mockApp.routes.time-capsules';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

/**
 * `GET /api/entries/random` as the API answers it: one unsealed entry of the filtered list, at random; the
 * `excludeId` entry only when nothing else matches.
 */
export async function handleRandomEntryRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/entries/random' || request.method() !== 'GET') {
    return false;
  }

  const { filtered } = getFilteredEntries(state, searchParams);
  const excludeId = Number(searchParams.get('excludeId') || '0');
  const candidates = filtered.filter((entry) => !isMockSealed(entry));
  const others = candidates.filter((entry) => entry.id !== excludeId);
  const pool = others.length > 0 ? others : candidates;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  if (!picked) {
    await fulfillApiError(route, 404, 'ENTRY_RANDOM_NO_MATCH', 'No entry matches these filters');
    return true;
  }

  await fulfillJson(route, {
    id: picked.id,
    date: picked.date,
    index: picked.index,
  });
  return true;
}

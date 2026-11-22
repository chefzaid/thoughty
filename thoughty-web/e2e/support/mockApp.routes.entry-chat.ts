import { getFilteredEntries } from './mockApp.routes.entries';
import { isMockSealed } from './mockApp.routes.time-capsules';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

/** The most entries one reply reads, as the API reads them. */
const MAX_DISCUSSED = 50;

/**
 * `POST /api/entries/chat` as the API answers it: the filtered entries (its day or date range among them) without the
 * sealed capsules, the newest fifty oldest first and numbered from 1, and a reply that cites the first and the last.
 */
export async function handleEntryChatRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/entries/chat' || request.method() !== 'POST') {
    return false;
  }

  state.lastEntryChatRequest = { query: searchParams.toString(), payload: request.postDataJSON() };
  const from = searchParams.get('dateFrom') ?? '';
  const to = searchParams.get('dateTo') ?? '';
  const matching = getFilteredEntries(state, searchParams).filtered
    .filter((entry) => !isMockSealed(entry) && (!from || entry.date >= from) && (!to || entry.date <= to))
    .sort((left, right) => right.date.localeCompare(left.date));
  if (matching.length === 0) {
    await fulfillApiError(route, 404, 'ENTRY_CHAT_NO_MATCH', 'No entry to discuss with these filters');
    return true;
  }

  const read = matching.slice(0, MAX_DISCUSSED).reverse();
  const cited = read.length > 1 ? [1, read.length] : [1];
  await fulfillJson(route, {
    reply: `It starts with ${cited.map((ref) => `[${ref}]`).join(' and ends with ')}.`,
    entries: read.map((entry, index) => ({ ref: index + 1, id: entry.id, date: entry.date, title: entry.title ?? null })),
    cited,
    total: matching.length,
  });
  return true;
}

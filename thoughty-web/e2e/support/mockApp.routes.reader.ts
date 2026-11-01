import { getFilteredEntries } from './mockApp.routes.entries';
import { isMockSealed } from './mockApp.routes.time-capsules';
import { fulfillApiError, fulfillJson, toEntryResponse, type RouteContext } from './mockApp.route-utils';
import { sortEntries } from './mockApp.shared';

/**
 * `GET /api/entries/reader` as the API answers it: the filtered entries (a day or a month of them) without the
 * sealed capsules, oldest day first and each day in its order, and the asked entry (else the first) with its
 * neighbours, place and count.
 */
export async function handleReaderRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/entries/reader' || request.method() !== 'GET') {
    return false;
  }

  const month = searchParams.get('month');
  const { filtered } = getFilteredEntries(state, searchParams);
  // sortEntries keeps each day's order; a stable sort by day then puts the oldest day first
  const read = sortEntries(filtered)
    .filter((entry) => !isMockSealed(entry) && (!month || entry.date.startsWith(`${month}-`)))
    .sort((left, right) => left.date.localeCompare(right.date));
  const entryId = searchParams.get('entryId');
  const position = entryId ? read.findIndex((entry) => String(entry.id) === entryId) : 0;
  const entry = read[position];
  if (!entry) {
    await fulfillApiError(
      route,
      404,
      entryId ? 'ENTRY_READER_NOT_FOUND' : 'ENTRY_READER_NO_MATCH',
      entryId ? 'This entry is not among the entries being read' : 'No entry to read with these filters',
    );
    return true;
  }

  await fulfillJson(route, {
    entry: toEntryResponse(entry, state),
    previousId: read[position - 1]?.id ?? null,
    nextId: read[position + 1]?.id ?? null,
    position: position + 1,
    total: read.length,
  });
  return true;
}

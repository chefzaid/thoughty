import { unique, type MockEntry } from './mockApp.shared';
import { fulfillApiError, fulfillJson, sortStrings, toEntryResponse, type RouteContext } from './mockApp.route-utils';
import { getFilteredEntries } from './mockApp.routes.entries';

/** An entry's place in the list as ascending values, as the API's cursors hold them (`lead_date_time_index_id`). */
type ListKey = [lead: number, day: number, timed: number, time: string, index: number, id: number];

const DAY_MS = 86_400_000;

function keyOf(lead: number, date: string, time: string | null, index: number, id: number): ListKey {
  // Newest day first: the later the day, the smaller the value
  return [lead, -Date.parse(`${date}T00:00:00Z`) / DAY_MS, time ? 1 : 0, time ?? '00:00', index, id];
}

function compareKeys(left: ListKey, right: ListKey): number {
  for (let place = 0; place < left.length; place += 1) {
    const [a, b] = [left[place]!, right[place]!];
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

function parseCursor(cursor: string): ListKey | null {
  const match = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})?_(\d{1,10})_(\d{1,10})$/.exec(cursor);
  return match ? keyOf(Number(match[1]), match[2]!, match[3] ?? null, Number(match[4]), Number(match[5])) : null;
}

/**
 * `GET /api/entries` as the API answers it: a batch of the filtered list in its order, from the start, after or
 * before a cursor, from a batch's own first entry, or around an entry (404 when the filters leave it out), with
 * the cursors to the batches beside it, how many entries come before it and how many match.
 */
export async function handleEntryListRoute({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/entries' || request.method() !== 'GET') {
    return false;
  }

  const { filtered, searchResults, leadOf } = getFilteredEntries(state, searchParams);
  const limit = Number(searchParams.get('limit') || '10');
  const listed = filtered
    .map((entry) => ({ entry, key: keyOf(leadOf(entry), entry.date, entry.time_of_day ?? null, entry.index, entry.id) }))
    .sort((left, right) => compareKeys(left.key, right.key));
  const cursorOf = ({ entry }: { entry: MockEntry }) =>
    [leadOf(entry), entry.date, entry.time_of_day ?? '', entry.index, entry.id].join('_');

  let start = 0;
  let end = Math.min(limit, listed.length);
  const around = Number(searchParams.get('around') || '0');
  const position = ['after', 'from', 'before'].map((name) => [name, searchParams.get(name)] as const).find(([, value]) => value);
  if (around) {
    const at = listed.findIndex(({ entry }) => entry.id === around);
    if (at < 0) {
      await fulfillApiError(route, 404, 'ENTRY_NOT_FOUND', 'Entry not found');
      return true;
    }
    const half = Math.floor(limit / 2);
    end = Math.min(listed.length, at + limit - Math.min(at, half));
    start = Math.max(0, end - limit);
  } else if (position) {
    const [name, cursor] = position;
    const key = parseCursor(cursor!)!;
    // The first entry after the cursor (or at it, for `from` and as the end of a `before` batch)
    const found = listed.findIndex((item) => compareKeys(item.key, key) >= (name === 'after' ? 1 : 0));
    const boundary = found < 0 ? listed.length : found;
    start = name === 'before' ? Math.max(0, boundary - limit) : boundary;
    end = name === 'before' ? boundary : Math.min(listed.length, boundary + limit);
  }

  const batch = listed.slice(start, end);
  const hasNext = position?.[0] === 'before' ? batch.length > 0 : end < listed.length;
  await fulfillJson(route, {
    entries: batch.map(({ entry }) => ({
      ...toEntryResponse(entry, state),
      ...(searchResults ? { search_matches: searchResults.get(entry.id)?.matches ?? [] } : {}),
    })),
    total: listed.length,
    offset: start,
    nextCursor: hasNext && batch.length > 0 ? cursorOf(batch.at(-1)!) : null,
    prevCursor: start > 0 && batch.length > 0 ? cursorOf(batch[0]!) : null,
    allTags: sortStrings(unique(state.entries.flatMap((entry) => entry.tags))),
  });
  return true;
}

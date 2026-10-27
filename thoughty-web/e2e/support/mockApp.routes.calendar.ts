import { getFilteredEntries } from './mockApp.routes.entries';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';
import { sortEntries } from './mockApp.shared';

/** The start of an entry as plain words, roughly as the API cuts its snippets. */
function mockSnippet(content: string): string {
  const text = content.replace(/^#{1,6}\s+|^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, '').replace(/[*_`>]+/g, '').replace(/\s+/g, ' ').trim();
  return text.length > 100 ? `${text.slice(0, 100).trimEnd()}…` : text;
}

/** `GET /api/entries/calendar` as the API answers it: the filtered month in day order, as short summaries. */
export async function handleCalendarRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/entries/calendar' || request.method() !== 'GET') {
    return false;
  }

  const month = searchParams.get('month') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'Month must be YYYY-MM');
    return true;
  }

  const { filtered } = getFilteredEntries(state, searchParams);
  const days = sortEntries(filtered.filter((entry) => entry.date.startsWith(`${month}-`))).reverse();
  // sortEntries puts the newest day first and each day in order; the calendar wants the oldest day first
  const inDayOrder = [...new Set(days.map((entry) => entry.date))]
    .flatMap((date) => days.filter((entry) => entry.date === date).reverse());

  await fulfillJson(route, {
    month,
    entries: inDayOrder.map((entry) => ({
      id: entry.id,
      diary_id: entry.diaryId ?? 1,
      date: entry.date,
      index: entry.index,
      time_of_day: entry.time_of_day ?? null,
      title: entry.title ?? null,
      snippet: mockSnippet(entry.content),
      mood: entry.mood ?? null,
    })),
  });
  return true;
}

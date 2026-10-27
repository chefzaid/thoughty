import { describe, expect, it, vi } from 'vitest';

import { createEntryCalendarService, type EntryCalendarQuery } from './entryCalendarService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const everything: EntryCalendarQuery = {
  month: '2026-10', search: '', tags: [], visibility: 'all', favorites: false,
  archiveStatus: 'all', mood: '', diaryId: null, entryIds: null,
};

describe('entryCalendarService', () => {
  it('asks for the month alone when no filter is set', async () => {
    const month = { month: '2026-10', entries: [] };
    const authFetch = vi.fn().mockResolvedValue(ok(month));

    await expect(createEntryCalendarService(authFetch).fetchMonth(everything)).resolves.toEqual({ data: month, error: null });
    expect(authFetch).toHaveBeenCalledWith('/api/entries/calendar?month=2026-10');
  });

  it('sends the diary and every filter set, as the list does', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ month: '2019-07', entries: [] }));
    const service = createEntryCalendarService(authFetch);

    await service.fetchMonth({
      month: '2019-07', search: 'lake picnic', tags: ['family', 'summer'], visibility: 'private', favorites: true,
      archiveStatus: 'active', mood: '4,5', diaryId: 2, entryIds: [9, 3],
    });
    await service.fetchMonth({ ...everything, search: '   ', entryIds: [] });

    const [first, second] = authFetch.mock.calls.map(([url]) => new URL(String(url), 'https://thoughty.test'));
    expect(Object.fromEntries(first!.searchParams)).toEqual({
      month: '2019-07', search: 'lake picnic', tags: 'family,summer', visibility: 'private', favorites: 'true',
      archiveStatus: 'active', mood: '4,5', diaryId: '2', ids: '9,3',
    });
    expect(Object.fromEntries(second!.searchParams)).toEqual({ month: '2026-10', ids: '0' });
  });

  it('gives a translation key when the month cannot be read', async () => {
    const authFetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(createEntryCalendarService(authFetch).fetchMonth(everything)).resolves.toEqual({
      data: null,
      error: 'calendarLoadFailed',
    });
  });
});

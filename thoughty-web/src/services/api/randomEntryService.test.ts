import { describe, expect, it, vi } from 'vitest';

import { createRandomEntryService } from './randomEntryService';
import type { EntryListQuery } from './entryListQuery';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const everything: EntryListQuery = {
  page: 3, limit: 10, search: '', filterTags: [], filterDate: '', filterVisibility: '',
  favorites: false, archiveStatus: 'active', diaryId: null, entryIds: null,
};

describe('randomEntryService', () => {
  it('asks with the list query and page size, without its page', async () => {
    const picked = { id: 7, date: '2024-03-10', index: 1, page: 2 };
    const authFetch = vi.fn().mockResolvedValue(json(picked));

    await expect(createRandomEntryService(authFetch).pick(everything, null)).resolves.toEqual({ data: picked, error: null });
    const url = new URL(String(authFetch.mock.calls[0]?.[0]), 'https://thoughty.test');
    expect(url.pathname).toBe('/api/entries/random');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: '10', search: '', tags: '', date: '', visibility: '', archiveStatus: 'active',
    });
  });

  it('sends every filter set and the entry picked last', async () => {
    const authFetch = vi.fn().mockResolvedValue(json({ id: 8, date: '2024-03-11', index: 2, page: 1 }));

    await createRandomEntryService(authFetch).pick({
      ...everything, search: 'harbor', sort: 'date', filterTags: ['walks'], filterDate: '2024-03-11', filterVisibility: 'private',
      favorites: true, mood: '4,5', diaryId: 2, eraId: 6, personId: 12,
    }, 7);

    const url = new URL(String(authFetch.mock.calls[0]?.[0]), 'https://thoughty.test');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: '10', search: 'harbor', sort: 'date', tags: 'walks', date: '2024-03-11', visibility: 'private',
      favorites: 'true', archiveStatus: 'active', mood: '4,5', diaryId: '2', eraId: '6', personId: '12', excludeId: '7',
    });
  });

  it("gives the API's coded reason when nothing matches, and a translation key when the request fails", async () => {
    const none = vi.fn().mockResolvedValue(json({ statusCode: 404, code: 'ENTRY_RANDOM_NO_MATCH', message: 'No entry matches these filters' }, 404));
    await expect(createRandomEntryService(none).pick(everything, null)).resolves.toEqual({
      data: null,
      error: 'apiError_ENTRY_RANDOM_NO_MATCH',
    });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const offline = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(createRandomEntryService(offline).pick(everything, null)).resolves.toEqual({ data: null, error: 'randomEntryFailed' });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { createEntryReaderService, normalizeReaderScope, readerScopeFromList, readerScopeOfMonth } from './entryReaderService';
import type { EntryListQuery } from './entryListQuery';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const everything: EntryListQuery = {
  page: 3, limit: 10, search: '', filterTags: [], filterDate: '', filterVisibility: '',
  favorites: false, archiveStatus: 'active', diaryId: null, entryIds: null,
};

describe('entryReaderService', () => {
  it("reads the list's filters and day as they are set, without its page, size or order", () => {
    expect(readerScopeFromList(everything)).toBe('archiveStatus=active');
    expect(readerScopeFromList({
      ...everything, search: 'harbor', sort: 'date', filterTags: ['walks', 'sea'], filterDate: '2024-03-11', filterVisibility: 'private',
      favorites: true, archiveStatus: 'all', mood: '4,5', diaryId: 2, eraId: 6, personId: 12, entryIds: [4, 9],
    })).toBe('search=harbor&ids=4%2C9&tags=walks%2Csea&date=2024-03-11&visibility=private&favorites=true&mood=4%2C5&diaryId=2&eraId=6&personId=12');
    // A meaning search that matched nothing still reads nothing
    expect(readerScopeFromList({ ...everything, entryIds: [] })).toBe('ids=0&archiveStatus=active');
  });

  it("reads a month under the calendar's filters", () => {
    expect(readerScopeOfMonth({
      month: '2026-10', search: '', tags: ['walks'], visibility: 'all', favorites: false, archiveStatus: 'active',
      mood: '', diaryId: null, eraId: null, entryIds: null,
    })).toBe('tags=walks&month=2026-10&archiveStatus=active');
  });

  it('keeps only the filters it knows, set, from a link edited by hand', () => {
    expect(normalizeReaderScope('page=4&tags=walks&search=+&evil=1&entryId=3&month=2026-10')).toBe('tags=walks&month=2026-10');
    expect(normalizeReaderScope('')).toBe('');
  });

  it('asks for the entry among the scope, or the first one', async () => {
    const page = { entry: { id: 7 }, previousId: null, nextId: 8, position: 1, total: 2 };
    const authFetch = vi.fn().mockResolvedValue(json(page));
    const service = createEntryReaderService(authFetch);

    await expect(service.read('tags=walks&page=2', null)).resolves.toEqual({ data: page, error: null });
    await service.read('tags=walks', 8);
    const urls = authFetch.mock.calls.map(([url]) => new URL(String(url), 'https://thoughty.test'));
    expect(urls[0]?.pathname).toBe('/api/entries/reader');
    expect(urls.map((url) => url.search)).toEqual(['?tags=walks', '?tags=walks&entryId=8']);
  });

  it("gives the API's coded reason, and a translation key when the request fails", async () => {
    const gone = vi.fn().mockResolvedValue(json({ statusCode: 404, code: 'ENTRY_READER_NOT_FOUND', message: 'Gone' }, 404));
    await expect(createEntryReaderService(gone).read('', 3)).resolves.toEqual({ data: null, error: 'apiError_ENTRY_READER_NOT_FOUND' });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const offline = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(createEntryReaderService(offline).read('', null)).resolves.toEqual({ data: null, error: 'readerLoadFailed' });
  });
});

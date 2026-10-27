import { describe, expect, it, vi } from 'vitest';

import { createSavedSearchesService, type SavedSearchFilters } from './savedSearchesService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const filters: SavedSearchFilters = {
  search: '', searchMode: 'keyword', sort: 'relevance', tags: ['family'], date: '2019-07-14',
  visibility: 'all', archiveStatus: 'active', favorites: true, mood: '',
};

describe('savedSearchesService', () => {
  it('lists, saves, renames and deletes saved searches', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ savedSearches: [], limit: 50 }));
    const service = createSavedSearchesService(authFetch);

    await expect(service.list()).resolves.toEqual({ data: { savedSearches: [], limit: 50 }, error: null });
    await service.create({ name: 'Family', diaryId: 2, filters });
    await service.rename(4, 'Family, 2019');
    await service.remove(4);

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/saved-searches', undefined, undefined],
      ['/api/saved-searches', 'POST', JSON.stringify({ name: 'Family', diaryId: 2, filters })],
      ['/api/saved-searches/4', 'PATCH', '{"name":"Family, 2019"}'],
      ['/api/saved-searches/4', 'DELETE', undefined],
    ]);
  });

  it('gives the API error code to translate, or a translation key when the request fails', async () => {
    const conflict = new Response(
      JSON.stringify({ statusCode: 409, message: 'A saved search with this name already exists', code: 'SAVED_SEARCH_NAME_TAKEN' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
    const service = createSavedSearchesService(vi.fn().mockResolvedValueOnce(conflict).mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.create({ name: 'Family', diaryId: null, filters })).resolves.toEqual({
      data: null,
      error: 'apiError_SAVED_SEARCH_NAME_TAKEN',
    });
    await expect(service.rename(4, 'Trips')).resolves.toEqual({ data: null, error: 'savedSearchRenameFailed' });
    await expect(service.remove(4)).resolves.toEqual({ data: null, error: 'savedSearchDeleteFailed' });
    await expect(service.list()).resolves.toEqual({ data: null, error: 'savedSearchesLoadFailed' });
  });
});

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createEntriesService } from './entriesService';

describe('entriesService', () => {
  let mockAuthFetch: Mock;
  let service: ReturnType<typeof createEntriesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthFetch = vi.fn();
    service = createEntriesService(mockAuthFetch);
  });

  describe('fetchEntries', () => {
    const defaultParams = {
      search: '',
      filterTags: [],
      filterDate: '',
      filterVisibility: 'all',
      favorites: false,
      archiveStatus: 'all' as const,
      diaryId: null,
    };

    it('returns a batch of entries with its cursors on successful fetch', async () => {
      const mockResponse = {
        entries: [{ id: 1, content: 'Test entry' }],
        total: 45,
        offset: 20,
        nextCursor: '1_2024-01-10__1_1',
        prevCursor: '1_2024-01-12__1_3',
        allTags: ['tag1', 'tag2'],
      };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.fetchEntries(defaultParams, 10);

      expect(result).toEqual(mockResponse);
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/entries?'));
      expect(new URL(String(mockAuthFetch.mock.calls[0]?.[0]), 'https://x.test').searchParams.get('limit')).toBe('10');
    });

    it('asks for the batch after, before or from a cursor, or around an entry', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ entries: [] }) });

      await service.fetchEntries(defaultParams, 20, { after: '1_2024-01-10__1_1' });
      await service.fetchEntries(defaultParams, 20, { before: '1_2024-01-12__1_3' });
      await service.fetchEntries(defaultParams, 20, { from: '1_2024-01-12__1_3' });
      await service.fetchEntries(defaultParams, 20, { around: 42 });

      const queries = mockAuthFetch.mock.calls.map(([url]) => new URL(String(url), 'https://x.test').searchParams);
      expect(queries.map((query) => [query.get('after'), query.get('before'), query.get('from'), query.get('around')])).toEqual([
        ['1_2024-01-10__1_1', null, null, null],
        [null, '1_2024-01-12__1_3', null, null],
        [null, null, '1_2024-01-12__1_3', null],
        [null, null, null, '42'],
      ]);
      expect(queries.every((query) => query.get('limit') === '20' && !query.has('page'))).toBe(true);
    });

    it('says when the filters leave out the entry to open around', async () => {
      mockAuthFetch.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ code: 'ENTRY_NOT_FOUND' }) });

      await expect(service.fetchEntries(defaultParams, 20, { around: 42 })).resolves.toBe('notFound');
      await expect(service.fetchEntries(defaultParams, 20, { after: '1_2024-01-10__1_1' })).resolves.toBeNull();
    });

    it('includes diaryId in params when provided', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] }),
      });

      await service.fetchEntries({ ...defaultParams, diaryId: 5 }, 10);

      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('diaryId=5'));
    });

    it('sends the search order only with a search', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] }),
      });

      await service.fetchEntries({ ...defaultParams, search: '"morning run" -rain', sort: 'date' }, 10);
      await service.fetchEntries({ ...defaultParams, search: ' ', sort: 'date' }, 10);

      const [withSearch, withoutSearch] = mockAuthFetch.mock.calls.map(([url]) => new URL(String(url), 'http://test').searchParams);
      expect(withSearch?.get('search')).toBe('"morning run" -rain');
      expect(withSearch?.get('sort')).toBe('date');
      expect(withoutSearch?.has('sort')).toBe(false);
    });

    it('sends the mood filter only when one is chosen', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] }),
      });

      await service.fetchEntries({ ...defaultParams, mood: '4,5' }, 10);
      await service.fetchEntries({ ...defaultParams, mood: '' }, 10);

      expect(new URL(String(mockAuthFetch.mock.calls[0]?.[0]), 'https://x.test').searchParams.get('mood')).toBe('4,5');
      expect(String(mockAuthFetch.mock.calls[1]?.[0])).not.toContain('mood=');
    });

    it('sends the life era filter only when one is chosen', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] }),
      });

      await service.fetchEntries({ ...defaultParams, eraId: 3 }, 10);
      await service.fetchEntries({ ...defaultParams, eraId: null }, 10);

      expect(new URL(String(mockAuthFetch.mock.calls[0]?.[0]), 'https://x.test').searchParams.get('eraId')).toBe('3');
      expect(String(mockAuthFetch.mock.calls[1]?.[0])).not.toContain('eraId=');
    });

    it('sends the person filter only when one is chosen', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] }),
      });

      await service.fetchEntries({ ...defaultParams, personId: 12 }, 10);
      await service.fetchEntries({ ...defaultParams, personId: null }, 10);

      expect(new URL(String(mockAuthFetch.mock.calls[0]?.[0]), 'https://x.test').searchParams.get('personId')).toBe('12');
      expect(String(mockAuthFetch.mock.calls[1]?.[0])).not.toContain('personId=');
    });

    it('returns null when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const result = await service.fetchEntries(defaultParams, 10);

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.fetchEntries(defaultParams, 10);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('handles missing entries data', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.fetchEntries(defaultParams, 10);

      expect(result).toEqual({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] });
    });
  });

  describe('fetchEntryDates', () => {
    it('returns dates on successful fetch', async () => {
      const mockDates = ['2024-01-01', '2024-01-02', '2024-01-03'];
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ dates: mockDates }),
      });

      const result = await service.fetchEntryDates();

      expect(result).toEqual(mockDates);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/dates');
    });

    it('returns empty array when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await service.fetchEntryDates();

      expect(result).toEqual([]);
    });

    it('returns empty array on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.fetchEntryDates();

      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('handles missing dates in response', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.fetchEntryDates();

      expect(result).toEqual([]);
    });
  });

  describe('navigateToFirst', () => {
    const firstFilters = {
      search: '', filterTags: [] as string[], filterDate: '', filterVisibility: '', favorites: false,
      archiveStatus: 'active' as const, diaryId: null,
    };

    it('returns navigation data on successful request', async () => {
      const mockResponse = { found: true, entryId: 42, years: [2024], months: ['2024-01'] };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.navigateToFirst(2024, 1, { ...firstFilters, diaryId: 3, favorites: true });

      expect(result).toEqual(mockResponse);
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('diaryId=3'));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('favorites=true'));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.not.stringContaining('limit='));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.not.stringContaining('date='));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/entries/first?'));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('year=2024'));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('month=1'));
    });

    it('leaves out the order of search results, which the API does not take here', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ found: false, years: [], months: [] }) });

      await service.navigateToFirst(2024, 5, { ...firstFilters, search: 'morning', sort: 'relevance' });

      const url = new URL(String(mockAuthFetch.mock.calls[0]?.[0]), 'http://localhost');
      expect(url.searchParams.get('search')).toBe('morning');
      expect(url.searchParams.has('sort')).toBe(false);
    });

    it('handles null month', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ found: true }),
      });

      await service.navigateToFirst(2024, null, firstFilters);

      expect(mockAuthFetch).toHaveBeenCalledWith(expect.not.stringContaining('month='));
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.navigateToFirst(2024, 1, firstFilters);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('navigateByDate', () => {
    it('returns navigation data on successful request', async () => {
      const mockResponse = { found: true, entryId: 15 };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.navigateByDate('2024-01-15', 0);

      expect(result).toEqual(mockResponse);
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/entries/by-date?'));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('date=2024-01-15'));
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.navigateByDate('2024-01-15', 0);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('fetchYearsMonths', () => {
    it('returns years and months on successful fetch', async () => {
      const mockResponse = { years: [2022, 2023, 2024], months: ['January', 'February'] };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.fetchYearsMonths();

      expect(result).toEqual(mockResponse);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/first');
    });

    it('handles missing data in response', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.fetchYearsMonths();

      expect(result).toEqual({ years: [], months: [] });
    });

    it('returns empty arrays on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.fetchYearsMonths();

      expect(result).toEqual({ years: [], months: [] });
      consoleSpy.mockRestore();
    });
  });

  describe('fetchEntries with favorites filter', () => {
    const baseParams = {
      search: '',
      filterTags: [] as string[],
      filterDate: '',
      filterVisibility: 'all',
      favorites: false,
      archiveStatus: 'all' as const,
      diaryId: null,
    };

    it('should include favorites param when true', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] }),
      });

      await service.fetchEntries({ ...baseParams, favorites: true }, 10);

      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('favorites=true'));
    });

    it('should not include favorites param when false', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], total: 0, offset: 0, nextCursor: null, prevCursor: null, allTags: [] }),
      });

      await service.fetchEntries({ ...baseParams, favorites: false }, 10);

      expect(mockAuthFetch).not.toHaveBeenCalledWith(expect.stringContaining('favorites=true'));
    });
  });

  describe('fetchEntryHistory', () => {
    it('returns revisions on success', async () => {
      const mockRevisions = [
        { id: 1, entryId: 5, content: 'old content', tags: ['a'], date: '2024-01-01', format: 'plaintext', visibility: 'private', createdAt: '2024-01-01T00:00:00Z' },
      ];
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRevisions),
      });

      const result = await service.fetchEntryHistory(5);

      expect(result).toEqual(mockRevisions);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/5/history');
    });

    it('returns empty array on failure', async () => {
      mockAuthFetch.mockResolvedValue({ ok: false });

      const result = await service.fetchEntryHistory(5);

      expect(result).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.fetchEntryHistory(5);

      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('fetchEntryBacklinks', () => {
    it('returns backlinks on success', async () => {
      const backlinks = [
        { id: 2, date: '2024-01-10', index: 1, content: 'References [[2024-01-15]]', tags: [] },
      ];
      mockAuthFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ backlinks })),
      });

      const result = await service.fetchEntryBacklinks(5);

      expect(result).toEqual(backlinks);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/5/backlinks');
    });

    it('returns an empty array when backlinks fetch fails', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(''),
      });

      const result = await service.fetchEntryBacklinks(5);

      expect(result).toEqual([]);
    });
  });
});

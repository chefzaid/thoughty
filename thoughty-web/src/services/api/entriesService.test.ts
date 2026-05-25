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
      page: 1,
      limit: 10,
      search: '',
      filterTags: [],
      filterDate: '',
      filterVisibility: 'all',
      favorites: false,
      diaryId: null,
    };

    it('returns entries on successful fetch', async () => {
      const mockResponse = {
        entries: [{ id: 1, content: 'Test entry' }],
        totalPages: 5,
        allTags: ['tag1', 'tag2'],
      };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.fetchEntries(defaultParams);

      expect(result).toEqual(mockResponse);
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/entries?'));
    });

    it('includes diaryId in params when provided', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], totalPages: 1, allTags: [] }),
      });

      await service.fetchEntries({ ...defaultParams, diaryId: 5 });

      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('diaryId=5'));
    });

    it('returns null when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const result = await service.fetchEntries(defaultParams);

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.fetchEntries(defaultParams);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('handles missing entries data', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.fetchEntries(defaultParams);

      expect(result).toEqual({ entries: [], totalPages: 1, allTags: [] });
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

  describe('createEntry', () => {
    const newEntry = {
      text: 'New entry content',
      tags: ['tag1', 'tag2'],
      date: '2024-01-15',
      visibility: 'private' as const,
      diaryId: 1,
    };

    it('returns true on successful creation', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, entryId: 42 }) });

      const result = await service.createEntry(newEntry);

      expect(result).toEqual({ success: true, entryId: 42 });
      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/entries',
        expect.objectContaining({ method: 'POST' }),
      );
      const requestOptions = mockAuthFetch.mock.calls[0]?.[1];
      expect(requestOptions).toBeDefined();
      expect(JSON.parse(String(requestOptions?.body))).toEqual({ ...newEntry, format: 'plain' });
    });

    it('returns false when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({ ok: false });

      const result = await service.createEntry(newEntry);

      expect(result).toEqual({ success: false });
    });

    it('returns false on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.createEntry(newEntry);

      expect(result).toEqual({ success: false });
      consoleSpy.mockRestore();
    });
  });

  describe('deleteEntry', () => {
    it('returns true on successful deletion', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true });

      const result = await service.deleteEntry(1);

      expect(result).toBe(true);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/1', { method: 'DELETE' });
    });

    it('returns false when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({ ok: false });

      const result = await service.deleteEntry(1);

      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.deleteEntry(1);

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('updateEntry', () => {
    const updateData = {
      text: 'Updated content',
      tags: ['tag3'],
      date: '2024-01-20',
      visibility: 'public' as const,
    };

    it('returns true on successful update', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true });

      const result = await service.updateEntry(1, updateData);

      expect(result).toBe(true);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
    });

    it('returns false when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({ ok: false });

      const result = await service.updateEntry(1, updateData);

      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.updateEntry(1, updateData);

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('toggleVisibility', () => {
    it('returns true on successful toggle to public', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true });

      const result = await service.toggleVisibility(1, 'public');

      expect(result).toBe(true);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/1/visibility', {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'public' }),
      });
    });

    it('returns true on successful toggle to private', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true });

      const result = await service.toggleVisibility(1, 'private');

      expect(result).toBe(true);
    });

    it('returns false when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({ ok: false });

      const result = await service.toggleVisibility(1, 'public');

      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.toggleVisibility(1, 'public');

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('renameTag', () => {
    it('returns the affected count when rename succeeds', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, affectedCount: 3 }),
      });

      const result = await service.renameTag('old-tag', 'new-tag');

      expect(result).toEqual({ success: true, affectedCount: 3 });
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/tags/rename', {
        method: 'PATCH',
        body: JSON.stringify({ oldTag: 'old-tag', newTag: 'new-tag' }),
      });
    });

    it('returns null when rename response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({ ok: false });

      const result = await service.renameTag('old-tag', 'new-tag');

      expect(result).toBeNull();
    });
  });

  describe('navigateToFirst', () => {
    it('returns navigation data on successful request', async () => {
      const mockResponse = { found: true, page: 3, entryId: 42 };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.navigateToFirst(2024, 1, 10);

      expect(result).toEqual(mockResponse);
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/entries/first?'));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('year=2024'));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('month=1'));
    });

    it('handles null month', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ found: true }),
      });

      await service.navigateToFirst(2024, null, 10);

      expect(mockAuthFetch).toHaveBeenCalledWith(expect.not.stringContaining('month='));
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.navigateToFirst(2024, 1, 10);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('navigateByDate', () => {
    it('returns navigation data on successful request', async () => {
      const mockResponse = { found: true, page: 2, entryId: 15 };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.navigateByDate('2024-01-15', 0, 10);

      expect(result).toEqual(mockResponse);
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/api/entries/by-date?'));
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('date=2024-01-15'));
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.navigateByDate('2024-01-15', 0, 10);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('navigateById', () => {
    it('returns navigation data on successful request', async () => {
      const mockResponse = { found: true, page: 4, entryId: 100 };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.navigateById(100, 10);

      expect(result).toEqual(mockResponse);
      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('id=100'));
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.navigateById(100, 10);

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

  describe('bulkOperation', () => {
    it('should send bulk operation and return result', async () => {
      const mockResult = { success: true, affectedCount: 3 };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
        text: () => Promise.resolve(JSON.stringify(mockResult)),
      });

      const result = await service.bulkOperation([1, 2, 3], 'delete');

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: [1, 2, 3], action: 'delete' }),
      });
      expect(result).toEqual(mockResult);
    });

    it('should pass options with bulk operation', async () => {
      const mockResult = { success: true, affectedCount: 2 };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
        text: () => Promise.resolve(JSON.stringify(mockResult)),
      });

      await service.bulkOperation([1, 2], 'visibility', { visibility: 'public' });

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: [1, 2], action: 'visibility', visibility: 'public' }),
      });
    });

    it('should return null when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('error'),
      });

      const result = await service.bulkOperation([1], 'delete');
      expect(result).toBeNull();
    });

    it('should return null and log error on exception', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.bulkOperation([1], 'delete');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('toggleFavorite', () => {
    it('should send PATCH request to toggle favorite', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await service.toggleFavorite(1, true);

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/1/favorite', {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: true }),
      });
      expect(result).toBe(true);
    });

    it('should return false when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
      });

      const result = await service.toggleFavorite(999, true);

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.toggleFavorite(1, true);

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('fetchEntries with favorites filter', () => {
    const baseParams = {
      page: 1,
      limit: 10,
      search: '',
      filterTags: [] as string[],
      filterDate: '',
      filterVisibility: 'all',
      favorites: false,
      diaryId: null,
    };

    it('should include favorites param when true', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], totalPages: 1, allTags: [] }),
      });

      await service.fetchEntries({ ...baseParams, favorites: true });

      expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('favorites=true'));
    });

    it('should not include favorites param when false', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entries: [], totalPages: 1, allTags: [] }),
      });

      await service.fetchEntries({ ...baseParams, favorites: false });

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
});

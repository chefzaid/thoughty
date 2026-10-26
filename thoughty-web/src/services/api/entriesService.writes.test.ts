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

    it('sends the mood and feelings only when they are recorded', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, entryId: 44 }) });

      await service.createEntry({ ...newEntry, mood: 4, feelings: ['calm', 'nostalgic'] });
      await service.createEntry({ ...newEntry, mood: null, feelings: [] });

      expect(JSON.parse(String(mockAuthFetch.mock.calls[0]?.[1]?.body))).toEqual({ ...newEntry, mood: 4, feelings: ['calm', 'nostalgic'], format: 'plain' });
      expect(JSON.parse(String(mockAuthFetch.mock.calls[1]?.[1]?.body))).toEqual({ ...newEntry, format: 'plain' });
    });

    it('sends the title and time of day only when they are set', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, entryId: 43 }) });

      await service.createEntry({ ...newEntry, title: 'Harbour', timeOfDay: '07:30' });
      await service.createEntry({ ...newEntry, title: null, timeOfDay: null });

      expect(JSON.parse(String(mockAuthFetch.mock.calls[0]?.[1]?.body))).toEqual({ ...newEntry, title: 'Harbour', timeOfDay: '07:30', format: 'plain' });
      expect(JSON.parse(String(mockAuthFetch.mock.calls[1]?.[1]?.body))).toEqual({ ...newEntry, format: 'plain' });
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
      format: 'plain' as const,
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

  describe('togglePinned', () => {
    it('sends PATCH request to toggle pinned state', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await service.togglePinned(1, true);

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/1/pinned', {
        method: 'PATCH',
        body: JSON.stringify({ isPinned: true }),
      });
      expect(result).toEqual({ success: true });
    });

    it('returns the server error message when pinning fails', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: 'Pinned entry limit reached (3)' })),
      });

      const result = await service.togglePinned(1, true);

      expect(result).toEqual({ success: false, error: 'Pinned entry limit reached (3)' });
    });
  });

  describe('setEntryTask', () => {
    it('sends the line and its state to the tasks route', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

      const result = await service.setEntryTask(4, 2, true);

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/entries/4/tasks', {
        method: 'PATCH',
        body: JSON.stringify({ line: 2, checked: true }),
      });
      expect(result).toEqual({ success: true });
    });

    it('returns the server message when the line is no longer a task', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: 'That line is no longer a task.' })),
      });

      await expect(service.setEntryTask(4, 2, false)).resolves.toEqual({ success: false, error: 'That line is no longer a task.' });
    });

    it('reports a failed request without an error message', async () => {
      mockAuthFetch.mockRejectedValue(new Error('offline'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.setEntryTask(4, 2, false)).resolves.toEqual({ success: false });
      consoleError.mockRestore();
    });
  });
});

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createDiariesService } from './diariesService';

describe('diariesService', () => {
  let mockAuthFetch: Mock;
  let service: ReturnType<typeof createDiariesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthFetch = vi.fn();
    service = createDiariesService(mockAuthFetch);
  });

  describe('fetchDiaries', () => {
    it('returns diaries on successful fetch', async () => {
      const mockDiaries = [
        { id: 1, name: 'Personal', icon: '📓', isDefault: true },
        { id: 2, name: 'Work', icon: '💼', isDefault: false },
      ];
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDiaries),
      });

      const result = await service.fetchDiaries();

      expect(result).toEqual(mockDiaries);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/diaries');
    });

    it('returns empty array when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const result = await service.fetchDiaries();

      expect(result).toEqual([]);
    });

    it('returns empty array when data is not array', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Not an array' }),
      });

      const result = await service.fetchDiaries();

      expect(result).toEqual([]);
    });

    it('returns empty array on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.fetchDiaries();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching diaries:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('createDiary', () => {
    it('returns success on successful creation', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: 'New Diary' }),
      });

      const result = await service.createDiary({ name: 'New Diary', icon: '📓' });

      expect(result).toEqual({ success: true });
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/diaries', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Diary', icon: '📓' }),
      });
    });

    it('returns error on failed creation', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Name already exists' }),
      });

      const result = await service.createDiary({ name: 'Existing Diary' });

      expect(result).toEqual({ success: false, error: 'Name already exists' });
    });

    it('returns default error when no error message provided', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await service.createDiary({ name: 'New Diary' });

      expect(result).toEqual({ success: false, error: 'Failed to create diary' });
    });

    it('returns error on exception', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.createDiary({ name: 'New Diary' });

      expect(result).toEqual({ success: false, error: 'Failed to create diary' });
      consoleSpy.mockRestore();
    });
  });

  describe('updateDiary', () => {
    it('returns success on successful update', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: 'Updated Diary' }),
      });

      const result = await service.updateDiary(1, { name: 'Updated Diary' });

      expect(result).toEqual({ success: true });
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/diaries/1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Diary' }),
      });
    });

    it('returns error on failed update', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Diary not found' }),
      });

      const result = await service.updateDiary(999, { name: 'Updated' });

      expect(result).toEqual({ success: false, error: 'Diary not found' });
    });

    it('returns default error when no error message provided', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await service.updateDiary(1, { name: 'Updated' });

      expect(result).toEqual({ success: false, error: 'Failed to update diary' });
    });

    it('returns error on exception', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.updateDiary(1, { name: 'Updated' });

      expect(result).toEqual({ success: false, error: 'Failed to update diary' });
      consoleSpy.mockRestore();
    });
  });

  describe('deleteDiary', () => {
    it('returns success on successful deletion', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.deleteDiary(1);

      expect(result).toEqual({ success: true });
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/diaries/1', { method: 'DELETE' });
    });

    it('returns error on failed deletion', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot delete default diary' }),
      });

      const result = await service.deleteDiary(1);

      expect(result).toEqual({ success: false, error: 'Cannot delete default diary' });
    });

    it('returns default error when no error message provided', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await service.deleteDiary(1);

      expect(result).toEqual({ success: false, error: 'Failed to delete diary' });
    });

    it('returns error on exception', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.deleteDiary(1);

      expect(result).toEqual({ success: false, error: 'Failed to delete diary' });
      consoleSpy.mockRestore();
    });
  });

  describe('setDefaultDiary', () => {
    it('returns success on successful set default', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.setDefaultDiary(2);

      expect(result).toEqual({ success: true });
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/diaries/2/default', { method: 'PATCH' });
    });

    it('returns error on failed set default', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Diary not found' }),
      });

      const result = await service.setDefaultDiary(999);

      expect(result).toEqual({ success: false, error: 'Diary not found' });
    });

    it('returns default error when no error message provided', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await service.setDefaultDiary(1);

      expect(result).toEqual({ success: false, error: 'Failed to set default diary' });
    });

    it('returns error on exception', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.setDefaultDiary(1);

      expect(result).toEqual({ success: false, error: 'Failed to set default diary' });
      consoleSpy.mockRestore();
    });
  });
});

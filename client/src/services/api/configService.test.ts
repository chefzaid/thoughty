import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createConfigService } from './configService';
import type { Config } from '../../types';

describe('configService', () => {
  let mockAuthFetch: Mock;
  let service: ReturnType<typeof createConfigService>;

  const mockConfig: Config = {
    theme: 'dark',
    language: 'en',
    dateFormat: 'YYYY-MM-DD',
    groupEntriesBy: 'day',
    entriesPerPage: 10,
    showPublicEntries: true,
    defaultVisibility: 'private',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthFetch = vi.fn();
    service = createConfigService(mockAuthFetch);
  });

  describe('fetchConfig', () => {
    it('returns config on successful fetch', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const result = await service.fetchConfig();

      expect(result).toEqual(mockConfig);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/config');
    });

    it('returns null when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const result = await service.fetchConfig();

      expect(result).toBeNull();
    });

    it('returns null when response is null', async () => {
      mockAuthFetch.mockResolvedValue(null);

      const result = await service.fetchConfig();

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.fetchConfig();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching config:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('updateConfig', () => {
    it('returns true on successful update', async () => {
      mockAuthFetch.mockResolvedValue({ ok: true });

      const result = await service.updateConfig(mockConfig);

      expect(result).toBe(true);
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/config', {
        method: 'POST',
        body: JSON.stringify(mockConfig),
      });
    });

    it('returns false when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({ ok: false });

      const result = await service.updateConfig(mockConfig);

      expect(result).toBe(false);
    });

    it('returns false when response is null', async () => {
      mockAuthFetch.mockResolvedValue(null);

      const result = await service.updateConfig(mockConfig);

      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.updateConfig(mockConfig);

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('fetchProfileStats', () => {
    it('returns profile stats on successful fetch', async () => {
      const mockStatsResponse = {
        totalThoughts: 150,
        thoughtsPerYear: { '2022': 30, '2023': 50, '2024': 70 },
        thoughtsPerTag: { 'tag1': 40, 'tag2': 60, 'tag3': 50 },
      };
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatsResponse),
      });

      const result = await service.fetchProfileStats();

      expect(result).toEqual({
        totalEntries: 150,
        uniqueTags: 3,
        firstEntryYear: 2022,
      });
      expect(mockAuthFetch).toHaveBeenCalledWith('/api/stats');
    });

    it('handles empty years - uses current year', async () => {
      const currentYear = new Date().getFullYear();
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          totalThoughts: 0,
          thoughtsPerYear: {},
          thoughtsPerTag: {},
        }),
      });

      const result = await service.fetchProfileStats();

      expect(result).toEqual({
        totalEntries: 0,
        uniqueTags: 0,
        firstEntryYear: currentYear,
      });
    });

    it('handles missing data in response', async () => {
      const currentYear = new Date().getFullYear();
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.fetchProfileStats();

      expect(result).toEqual({
        totalEntries: 0,
        uniqueTags: 0,
        firstEntryYear: currentYear,
      });
    });

    it('returns null when response is not ok', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await service.fetchProfileStats();

      expect(result).toBeNull();
    });

    it('returns null when response is null', async () => {
      mockAuthFetch.mockResolvedValue(null);

      const result = await service.fetchProfileStats();

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.fetchProfileStats();

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });
});

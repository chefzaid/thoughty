import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCloudSyncService } from './cloudSyncService';

describe('cloudSyncService', () => {
  let authFetch: ReturnType<typeof vi.fn>;
  let service: ReturnType<typeof createCloudSyncService>;

  beforeEach(() => {
    authFetch = vi.fn();
    service = createCloudSyncService(authFetch);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('should fetch and return cloud status', async () => {
      const mockStatus = {
        google_drive: { connected: true, connectedAt: '2024-01-01' },
        onedrive: { connected: false },
      };
      authFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus,
        text: async () => JSON.stringify(mockStatus),
      });

      const result = await service.getStatus();

      expect(result).toEqual(mockStatus);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/status');
    });

    it('should return null on error', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.getStatus();

      expect(result).toBeNull();
    });

    it('should return null on fetch exception', async () => {
      authFetch.mockRejectedValue(new Error('network error'));

      const result = await service.getStatus();

      expect(result).toBeNull();
    });
  });

  describe('getAuthUrl', () => {
    it('should return auth URL from API', async () => {
      const mockData = { url: 'https://accounts.google.com/oauth?...' };
      authFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
        text: async () => JSON.stringify(mockData),
      });

      const result = await service.getAuthUrl('google_drive', 'http://localhost/callback');

      expect(result).toBe('https://accounts.google.com/oauth?...');
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/auth-url', {
        method: 'POST',
        body: JSON.stringify({ provider: 'google_drive', redirectUri: 'http://localhost/callback' }),
      });
    });

    it('should return null when request fails', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.getAuthUrl('google_drive', 'http://localhost/callback');

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.getAuthUrl('google_drive', 'http://localhost/callback');

      expect(result).toBeNull();
    });
  });

  describe('connect', () => {
    it('should send connect request and return true on success', async () => {
      authFetch.mockResolvedValue({ ok: true });

      const result = await service.connect('google_drive', 'auth-code', 'http://localhost/callback');

      expect(result).toBe(true);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/connect', {
        method: 'POST',
        body: JSON.stringify({ provider: 'google_drive', code: 'auth-code', redirectUri: 'http://localhost/callback' }),
      });
    });

    it('should return false on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.connect('google_drive', 'bad-code', 'http://localhost/callback');

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.connect('google_drive', 'code', 'http://localhost/callback');

      expect(result).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should send disconnect request and return true on success', async () => {
      authFetch.mockResolvedValue({ ok: true });

      const result = await service.disconnect('onedrive');

      expect(result).toBe(true);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/disconnect', {
        method: 'POST',
        body: JSON.stringify({ provider: 'onedrive' }),
      });
    });

    it('should return false on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.disconnect('onedrive');

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.disconnect('onedrive');

      expect(result).toBe(false);
    });
  });

  describe('listFiles', () => {
    it('should fetch and return file list', async () => {
      const mockFiles = [
        { id: '1', name: 'export.txt', size: 1024, modifiedAt: '2024-01-01' },
      ];
      authFetch.mockResolvedValue({
        ok: true,
        json: async () => mockFiles,
        text: async () => JSON.stringify(mockFiles),
      });

      const result = await service.listFiles('google_drive');

      expect(result).toEqual(mockFiles);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/files?provider=google_drive');
    });

    it('should return empty array on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.listFiles('google_drive');

      expect(result).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.listFiles('google_drive');

      expect(result).toEqual([]);
    });
  });

  describe('uploadExport', () => {
    it('should upload export and return file info', async () => {
      const mockFile = { id: '1', name: 'export.txt', size: 100, modifiedAt: '2024-01-01' };
      authFetch.mockResolvedValue({
        ok: true,
        json: async () => mockFile,
        text: async () => JSON.stringify(mockFile),
      });

      const result = await service.uploadExport('google_drive', { format: 'txt', includeVisibility: true });

      expect(result).toEqual(mockFile);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/upload', {
        method: 'POST',
        body: JSON.stringify({ provider: 'google_drive', format: 'txt', includeVisibility: true }),
      });
    });

    it('should return null on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.uploadExport('google_drive');

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.uploadExport('google_drive');

      expect(result).toBeNull();
    });
  });

  describe('downloadFile', () => {
    it('should download and return file content', async () => {
      const mockData = { content: 'file content' };
      authFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
        text: async () => JSON.stringify(mockData),
      });

      const result = await service.downloadFile('onedrive', 'file-123');

      expect(result).toBe('file content');
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/download', {
        method: 'POST',
        body: JSON.stringify({ provider: 'onedrive', fileId: 'file-123' }),
      });
    });

    it('should return null on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.downloadFile('onedrive', 'file-123');

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.downloadFile('onedrive', 'file-123');

      expect(result).toBeNull();
    });
  });

  describe('getSchedules', () => {
    it('should fetch and return sync schedules', async () => {
      const mockSchedules = {
        google_drive: { enabled: true, frequency: 'daily', format: 'txt', lastSyncAt: '2024-01-01' },
        onedrive: { enabled: false },
      };
      authFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSchedules,
        text: async () => JSON.stringify(mockSchedules),
      });

      const result = await service.getSchedules();

      expect(result).toEqual(mockSchedules);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/schedules');
    });

    it('should return null on error', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.getSchedules();

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.getSchedules();

      expect(result).toBeNull();
    });
  });

  describe('setSchedule', () => {
    it('should send schedule config and return true on success', async () => {
      authFetch.mockResolvedValue({ ok: true });

      const result = await service.setSchedule('google_drive', {
        frequency: 'daily',
        format: 'json',
        diaryId: 5,
        includeVisibility: true,
      });

      expect(result).toBe(true);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/schedule', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'google_drive',
          frequency: 'daily',
          format: 'json',
          diaryId: 5,
          includeVisibility: true,
        }),
      });
    });

    it('should return false on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.setSchedule('google_drive', { frequency: 'daily' });

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.setSchedule('google_drive', { frequency: 'daily' });

      expect(result).toBe(false);
    });
  });

  describe('deleteSchedule', () => {
    it('should send delete request and return true on success', async () => {
      authFetch.mockResolvedValue({ ok: true });

      const result = await service.deleteSchedule('onedrive');

      expect(result).toBe(true);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/schedule?provider=onedrive', {
        method: 'DELETE',
      });
    });

    it('should return false on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.deleteSchedule('onedrive');

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.deleteSchedule('onedrive');

      expect(result).toBe(false);
    });
  });

  describe('triggerSync', () => {
    it('should trigger sync and return result with changes', async () => {
      const mockResult = {
        synced: true,
        message: 'Sync completed successfully',
        file: { id: '1', name: 'export.txt', size: 100, modifiedAt: '2024-01-01' },
      };
      authFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResult,
        text: async () => JSON.stringify(mockResult),
      });

      const result = await service.triggerSync('google_drive');

      expect(result).toEqual(mockResult);
      expect(authFetch).toHaveBeenCalledWith('/api/cloud-sync/sync', {
        method: 'POST',
        body: JSON.stringify({ provider: 'google_drive' }),
      });
    });

    it('should return no-changes result', async () => {
      const mockResult = {
        synced: false,
        message: 'No changes detected since last sync',
      };
      authFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResult,
        text: async () => JSON.stringify(mockResult),
      });

      const result = await service.triggerSync('onedrive');

      expect(result?.synced).toBe(false);
    });

    it('should return null on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const result = await service.triggerSync('google_drive');

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      authFetch.mockRejectedValue(new Error('network'));

      const result = await service.triggerSync('google_drive');

      expect(result).toBeNull();
    });
  });
});

import { BadRequestException } from '@nestjs/common';
import { CloudSyncService } from './cloud-sync.service';
import { createCloudSyncTestBed } from './cloud-sync.test-helpers';

describe('CloudSyncService', () => {
  let service: CloudSyncService;
  let settingRepository: any;
  let ioService: any;
  let googleDriveProvider: any;

  beforeEach(async () => {
    ({ service, settingRepository, ioService, googleDriveProvider } = await createCloudSyncTestBed());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSyncSchedules', () => {
    it('should return schedule config for all providers', async () => {
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_enabled') return { value: 'true' };
        if (where.key === 'cloud_google_drive_sync_frequency') return { value: 'daily' };
        if (where.key === 'cloud_google_drive_sync_format') return { value: 'json' };
        if (where.key === 'cloud_google_drive_sync_diary_id') return { value: '5' };
        if (where.key === 'cloud_google_drive_sync_include_visibility') return { value: 'true' };
        if (where.key === 'cloud_google_drive_last_sync_at') return { value: '2024-06-01T00:00:00Z' };
        if (where.key === 'cloud_google_drive_last_sync_hash') return { value: 'abc123' };
        return null;
      });

      const result = await service.getSyncSchedules(1);

      expect(result.google_drive.enabled).toBe(true);
      expect(result.google_drive.frequency).toBe('daily');
      expect(result.google_drive.format).toBe('json');
      expect(result.google_drive.diaryId).toBe(5);
      expect(result.google_drive.includeVisibility).toBe(true);
      expect(result.google_drive.lastSyncAt).toBe('2024-06-01T00:00:00Z');
      expect(result.google_drive.lastSyncHash).toBe('abc123');
      expect(result.google_drive.nextSyncAt).toBeDefined();
      expect(result.onedrive.enabled).toBe(false);
      expect(result.dropbox.enabled).toBe(false);
    });

    it('should return disabled schedule when no settings exist', async () => {
      settingRepository.findOne.mockResolvedValue(null);

      const result = await service.getSyncSchedules(1);

      expect(result.google_drive.enabled).toBe(false);
      expect(result.onedrive.enabled).toBe(false);
      expect(result.dropbox.enabled).toBe(false);
    });

    it('should compute nextSyncAt from lastSyncAt and frequency', async () => {
      const lastSync = new Date('2024-06-01T12:00:00Z');
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_enabled') return { value: 'true' };
        if (where.key === 'cloud_google_drive_sync_frequency') return { value: 'every_6h' };
        if (where.key === 'cloud_google_drive_last_sync_at') return { value: lastSync.toISOString() };
        return null;
      });

      const result = await service.getSyncSchedules(1);
      const expected = new Date(lastSync.getTime() + 6 * 60 * 60 * 1000).toISOString();
      expect(result.google_drive.nextSyncAt).toBe(expected);
    });
  });

  describe('setSyncSchedule', () => {
    it('should save schedule settings when provider is connected', async () => {
      settingRepository.findOne.mockResolvedValue({ value: 'encrypted-token' });
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.setSyncSchedule(1, 'google_drive', 'daily', 'json', 5, true);

      expect(result).toEqual({ success: true });
      expect(settingRepository.upsert).toHaveBeenCalledTimes(5);
      expect(settingRepository.upsert).toHaveBeenCalledWith(
        { userId: 1, key: 'cloud_google_drive_sync_enabled', value: 'true' },
        ['userId', 'key'],
      );
      expect(settingRepository.upsert).toHaveBeenCalledWith(
        { userId: 1, key: 'cloud_google_drive_sync_frequency', value: 'daily' },
        ['userId', 'key'],
      );
    });

    it('should throw when provider is not connected', async () => {
      settingRepository.findOne.mockResolvedValue(null);

      await expect(
        service.setSyncSchedule(1, 'google_drive', 'daily'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteSyncSchedule', () => {
    it('should delete all schedule settings', async () => {
      settingRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteSyncSchedule(1, 'google_drive');

      expect(result).toEqual({ success: true });
      expect(settingRepository.delete).toHaveBeenCalledTimes(7);
      expect(settingRepository.delete).toHaveBeenCalledWith({ userId: 1, key: 'cloud_google_drive_sync_enabled' });
      expect(settingRepository.delete).toHaveBeenCalledWith({ userId: 1, key: 'cloud_google_drive_last_sync_hash' });
    });
  });

  describe('executeDiffSync', () => {
    it('should upload when content hash differs from stored hash', async () => {
      const futureExpiry = String(Date.now() + 3600000);
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_format') return { value: 'txt' };
        if (where.key === 'cloud_google_drive_sync_diary_id') return null;
        if (where.key === 'cloud_google_drive_sync_include_visibility') return null;
        if (where.key === 'cloud_google_drive_last_sync_hash') return { value: 'old-hash' };
        if (where.key === 'cloud_google_drive_access_token') return { value: service['encrypt']('access-token') };
        if (where.key === 'cloud_google_drive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_google_drive_expires_at') return { value: futureExpiry };
        return null;
      });

      ioService.export.mockResolvedValue({
        content: 'new content',
        filename: 'thoughty_export.txt',
        contentType: 'text/plain',
      });

      const mockFile = { id: '1', name: 'thoughty_export.txt', size: 11, modifiedAt: '2024-01-01' };
      googleDriveProvider.uploadFile.mockResolvedValue(mockFile);
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.executeDiffSync(1, 'google_drive');

      expect(result.synced).toBe(true);
      expect(result.message).toBe('Sync completed successfully');
      expect(result.file).toEqual(mockFile);
      expect(googleDriveProvider.uploadFile).toHaveBeenCalled();
    });

    it('should skip upload when content hash matches stored hash', async () => {
      const { createHash } = await import('node:crypto');
      const content = 'same content';
      const contentHash = createHash('sha256').update(content).digest('hex');

      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_format') return { value: 'txt' };
        if (where.key === 'cloud_google_drive_sync_diary_id') return null;
        if (where.key === 'cloud_google_drive_sync_include_visibility') return null;
        if (where.key === 'cloud_google_drive_last_sync_hash') return { value: contentHash };
        return null;
      });

      ioService.export.mockResolvedValue({
        content,
        filename: 'thoughty_export.txt',
        contentType: 'text/plain',
      });
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.executeDiffSync(1, 'google_drive');

      expect(result.synced).toBe(false);
      expect(result.message).toBe('No changes detected since last sync');
      expect(googleDriveProvider.uploadFile).not.toHaveBeenCalled();
    });

    it('should upload when no previous hash exists', async () => {
      const futureExpiry = String(Date.now() + 3600000);
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_format') return null;
        if (where.key === 'cloud_google_drive_sync_diary_id') return null;
        if (where.key === 'cloud_google_drive_sync_include_visibility') return null;
        if (where.key === 'cloud_google_drive_last_sync_hash') return null;
        if (where.key === 'cloud_google_drive_access_token') return { value: service['encrypt']('access-token') };
        if (where.key === 'cloud_google_drive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_google_drive_expires_at') return { value: futureExpiry };
        return null;
      });

      ioService.export.mockResolvedValue({
        content: 'first sync content',
        filename: 'thoughty_export.txt',
        contentType: 'text/plain',
      });

      const mockFile = { id: '1', name: 'thoughty_export.txt', size: 18, modifiedAt: '2024-01-01' };
      googleDriveProvider.uploadFile.mockResolvedValue(mockFile);
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.executeDiffSync(1, 'google_drive');

      expect(result.synced).toBe(true);
      expect(result.file).toEqual(mockFile);
    });
  });

  describe('checkSyncDue', () => {
    it('should return true when sync is overdue', async () => {
      const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_enabled') return { value: 'true' };
        if (where.key === 'cloud_google_drive_sync_frequency') return { value: 'daily' };
        if (where.key === 'cloud_google_drive_last_sync_at') return { value: pastTime };
        return null;
      });

      const result = await service.checkSyncDue(1, 'google_drive');
      expect(result).toBe(true);
    });

    it('should return false when sync is not yet due', async () => {
      const recentTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_enabled') return { value: 'true' };
        if (where.key === 'cloud_google_drive_sync_frequency') return { value: 'daily' };
        if (where.key === 'cloud_google_drive_last_sync_at') return { value: recentTime };
        return null;
      });

      const result = await service.checkSyncDue(1, 'google_drive');
      expect(result).toBe(false);
    });

    it('should return true when never synced', async () => {
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_enabled') return { value: 'true' };
        if (where.key === 'cloud_google_drive_sync_frequency') return { value: 'daily' };
        if (where.key === 'cloud_google_drive_last_sync_at') return null;
        return null;
      });

      const result = await service.checkSyncDue(1, 'google_drive');
      expect(result).toBe(true);
    });

    it('should return false when schedule is disabled', async () => {
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_enabled') return { value: 'false' };
        return null;
      });

      const result = await service.checkSyncDue(1, 'google_drive');
      expect(result).toBe(false);
    });
  });
});

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
        if (where.key === 'cloud_google_drive_sync_time_zone') return { value: 'Pacific/Kiritimati' };
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
      expect(result.google_drive.timeZone).toBe('Pacific/Kiritimati');
      expect(result.google_drive.lastSyncAt).toBe('2024-06-01T00:00:00Z');
      expect(result.google_drive.lastSyncHash).toBe('abc123');
      expect(result.google_drive.nextSyncAt).toBeDefined();
      expect(result.onedrive.enabled).toBe(false);
      expect(result.onedrive.timeZone).toBeUndefined();
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

      const result = await service.setSyncSchedule(1, 'google_drive', 'daily', 'Pacific/Pago_Pago', 'json', 5, true);

      expect(result).toEqual({ success: true });
      expect(settingRepository.upsert).toHaveBeenCalledTimes(6);
      expect(settingRepository.upsert).toHaveBeenCalledWith(
        { userId: 1, key: 'cloud_google_drive_sync_time_zone', value: 'Pacific/Pago_Pago' },
        ['userId', 'key'],
      );
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
        service.setSyncSchedule(1, 'google_drive', 'daily', 'Europe/Paris'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a time zone that is not an IANA zone, before reading anything', async () => {
      settingRepository.findOne.mockResolvedValue({ value: 'encrypted-token' });

      await expect(service.setSyncSchedule(1, 'google_drive', 'daily', 'Mars/Olympus_Mons')).rejects.toMatchObject({
        response: { code: 'VALIDATION_FAILED', message: 'Unknown time zone' },
      });
      expect(settingRepository.findOne).not.toHaveBeenCalled();
      expect(settingRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('deleteSyncSchedule', () => {
    it('should delete all schedule settings', async () => {
      settingRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteSyncSchedule(1, 'google_drive');

      expect(result).toEqual({ success: true });
      expect(settingRepository.delete).toHaveBeenCalledTimes(8);
      expect(settingRepository.delete).toHaveBeenCalledWith({ userId: 1, key: 'cloud_google_drive_sync_time_zone' });
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
      // A schedule saved without a time zone names the worker's files by the UTC day
      expect(ioService.export).toHaveBeenCalledWith(1, undefined, false, expect.any(String), new Date().toISOString().slice(0, 10));
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

      const result = await service.executeDiffSync(1, 'google_drive', '2026-11-01');

      expect(result.synced).toBe(true);
      expect(result.file).toEqual(mockFile);
      // Sync now names the file after the writer's day
      expect(ioService.export).toHaveBeenCalledWith(1, undefined, false, 'txt', '2026-11-01');
    });
  });

  describe('executeDiffSync on a schedule saved with a time zone', () => {
    // 10:30 UTC on 31 October: already 00:30 on 1 November in Kiritimati (UTC+14), still 23:30 on
    // 30 October in Pago Pago (UTC-11).
    const NOW = new Date('2026-10-31T10:30:00.000Z');

    function scheduleIn(timeZone: string | null) {
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_sync_time_zone') return timeZone === null ? null : { value: timeZone };
        if (where.key === 'cloud_google_drive_last_sync_hash') return null;
        if (where.key === 'cloud_google_drive_access_token') return { value: service['encrypt']('access-token') };
        if (where.key === 'cloud_google_drive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_google_drive_expires_at') return { value: String(NOW.getTime() + 3600000) };
        return null;
      });
      ioService.export.mockResolvedValue({ content: 'entries', filename: 'thoughty_all_diaries.txt', contentType: 'text/plain' });
      googleDriveProvider.uploadFile.mockResolvedValue({ id: '1', name: 'thoughty_all_diaries.txt', size: 7, modifiedAt: NOW.toISOString() });
      settingRepository.upsert.mockResolvedValue({});
    }

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([
      ['Pacific/Kiritimati', '2026-11-01'],
      ['Pacific/Pago_Pago', '2026-10-30'],
      [null, '2026-10-31'],
      ['Mars/Olympus_Mons', '2026-10-31'],
    ])('names the worker’s file after the day in %s (%s)', async (timeZone, day) => {
      scheduleIn(timeZone);

      const result = await service.executeDiffSync(1, 'google_drive');

      expect(result.synced).toBe(true);
      expect(ioService.export).toHaveBeenCalledWith(1, undefined, false, 'txt', day);
    });

    it('lets the day sent with Sync now name the file over the schedule’s time zone', async () => {
      scheduleIn('Pacific/Kiritimati');

      await service.executeDiffSync(1, 'google_drive', '2026-10-31');

      expect(ioService.export).toHaveBeenCalledWith(1, undefined, false, 'txt', '2026-10-31');
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

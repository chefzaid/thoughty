import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CloudSyncService } from './cloud-sync.service';
import { Setting } from '@/database/entities';
import { IoService } from '@/modules/io/io.service';
import { GoogleDriveProvider } from './providers/google-drive.provider';
import { OneDriveProvider } from './providers/onedrive.provider';
import { DropboxProvider } from './providers/dropbox.provider';

describe('CloudSyncService', () => {
  let service: CloudSyncService;
  let settingRepository: any;
  let ioService: any;
  let googleDriveProvider: any;
  let oneDriveProvider: any;
  let dropboxProvider: any;

  beforeEach(async () => {
    settingRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };

    ioService = {
      export: jest.fn(),
    };

    googleDriveProvider = {
      getAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      refreshAccessToken: jest.fn(),
      listFiles: jest.fn(),
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
    };

    oneDriveProvider = {
      getAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      refreshAccessToken: jest.fn(),
      listFiles: jest.fn(),
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
    };

    dropboxProvider = {
      getAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      refreshAccessToken: jest.fn(),
      listFiles: jest.fn(),
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudSyncService,
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: IoService, useValue: ioService },
        { provide: GoogleDriveProvider, useValue: googleDriveProvider },
        { provide: OneDriveProvider, useValue: oneDriveProvider },
        { provide: DropboxProvider, useValue: dropboxProvider },
      ],
    }).compile();

    service = module.get<CloudSyncService>(CloudSyncService);
    jest.spyOn((service as any).logger, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should return auth URL for google_drive', async () => {
      googleDriveProvider.getAuthUrl.mockReturnValue('https://accounts.google.com/oauth?...');

      const result = await service.getAuthUrl('google_drive', 'http://localhost/callback', 'state123');

      expect(result).toEqual({ url: 'https://accounts.google.com/oauth?...' });
      expect(googleDriveProvider.getAuthUrl).toHaveBeenCalledWith('http://localhost/callback', 'state123');
    });

    it('should return auth URL for onedrive', async () => {
      oneDriveProvider.getAuthUrl.mockReturnValue('https://login.microsoftonline.com/oauth?...');

      const result = await service.getAuthUrl('onedrive', 'http://localhost/callback', 'state123');

      expect(result).toEqual({ url: 'https://login.microsoftonline.com/oauth?...' });
      expect(oneDriveProvider.getAuthUrl).toHaveBeenCalledWith('http://localhost/callback', 'state123');
    });

    it('should throw BadRequestException for unknown provider', async () => {
      await expect(
        service.getAuthUrl('icloud' as any, 'http://localhost/callback', 'state'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('connect', () => {
    it('should exchange code and store tokens', async () => {
      const mockTokens = {
        accessToken: 'access123',
        refreshToken: 'refresh123',
        expiresAt: Date.now() + 3600000,
      };
      googleDriveProvider.exchangeCode.mockResolvedValue(mockTokens);
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.connect(1, 'google_drive', 'auth-code', 'http://localhost/callback');

      expect(result.success).toBe(true);
      expect(result.connectedAt).toBeDefined();
      expect(googleDriveProvider.exchangeCode).toHaveBeenCalledWith('auth-code', 'http://localhost/callback');
      expect(settingRepository.upsert).toHaveBeenCalledTimes(4); // access_token, refresh_token, expires_at, connected_at
    });

    it('should throw BadRequestException for unknown provider', async () => {
      await expect(
        service.connect(1, 'icloud' as any, 'code', 'http://localhost/callback'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('disconnect', () => {
    it('should clear all stored tokens', async () => {
      settingRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.disconnect(1, 'google_drive');

      expect(result).toEqual({ success: true });
      expect(settingRepository.delete).toHaveBeenCalledTimes(4);
      expect(settingRepository.delete).toHaveBeenCalledWith({ userId: 1, key: 'cloud_google_drive_access_token' });
      expect(settingRepository.delete).toHaveBeenCalledWith({ userId: 1, key: 'cloud_google_drive_refresh_token' });
      expect(settingRepository.delete).toHaveBeenCalledWith({ userId: 1, key: 'cloud_google_drive_expires_at' });
      expect(settingRepository.delete).toHaveBeenCalledWith({ userId: 1, key: 'cloud_google_drive_connected_at' });
    });
  });

  describe('getStatus', () => {
    it('should return connected status for providers with tokens', async () => {
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_access_token') return { value: 'encrypted-token' };
        if (where.key === 'cloud_google_drive_connected_at') return { value: '2024-01-01T00:00:00Z' };
        return null;
      });

      const result = await service.getStatus(1);

      expect(result.google_drive).toEqual({ connected: true, connectedAt: '2024-01-01T00:00:00Z' });
      expect(result.onedrive).toEqual({ connected: false, connectedAt: undefined });
      expect(result.dropbox).toEqual({ connected: false, connectedAt: undefined });
    });

    it('should return disconnected for all providers when no tokens exist', async () => {
      settingRepository.findOne.mockResolvedValue(null);

      const result = await service.getStatus(1);

      expect(result.google_drive).toEqual({ connected: false, connectedAt: undefined });
      expect(result.onedrive).toEqual({ connected: false, connectedAt: undefined });
      expect(result.dropbox).toEqual({ connected: false, connectedAt: undefined });
    });
  });

  describe('listFiles', () => {
    it('should list files when connected', async () => {
      // Mock stored tokens (access token not expired)
      const futureExpiry = String(Date.now() + 3600000);
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_access_token') return { value: service['encrypt']('access-token') };
        if (where.key === 'cloud_google_drive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_google_drive_expires_at') return { value: futureExpiry };
        return null;
      });

      const mockFiles = [
        { id: '1', name: 'export.txt', size: 1024, modifiedAt: '2024-01-01' },
      ];
      googleDriveProvider.listFiles.mockResolvedValue(mockFiles);

      const result = await service.listFiles(1, 'google_drive');

      expect(result).toEqual(mockFiles);
      expect(googleDriveProvider.listFiles).toHaveBeenCalledWith('access-token');
    });

    it('should throw when not connected', async () => {
      settingRepository.findOne.mockResolvedValue(null);

      await expect(service.listFiles(1, 'google_drive')).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadExport', () => {
    it('should export and upload to cloud', async () => {
      const futureExpiry = String(Date.now() + 3600000);
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_access_token') return { value: service['encrypt']('access-token') };
        if (where.key === 'cloud_google_drive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_google_drive_expires_at') return { value: futureExpiry };
        return null;
      });

      ioService.export.mockResolvedValue({
        content: 'exported content',
        filename: 'thoughty_export.txt',
        contentType: 'text/plain',
      });

      const mockFileInfo = { id: '1', name: 'thoughty_export.txt', size: 16, modifiedAt: '2024-01-01' };
      googleDriveProvider.uploadFile.mockResolvedValue(mockFileInfo);

      const result = await service.uploadExport(1, 'google_drive', undefined, 'txt', false);

      expect(result).toEqual(mockFileInfo);
      expect(ioService.export).toHaveBeenCalledWith(1, undefined, false, 'txt');
      expect(googleDriveProvider.uploadFile).toHaveBeenCalledWith('access-token', 'thoughty_export.txt', 'exported content', 'text/plain');
    });
  });

  describe('downloadFile', () => {
    it('should download file content from cloud', async () => {
      const futureExpiry = String(Date.now() + 3600000);
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_onedrive_access_token') return { value: service['encrypt']('access-token') };
        if (where.key === 'cloud_onedrive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_onedrive_expires_at') return { value: futureExpiry };
        return null;
      });

      oneDriveProvider.downloadFile.mockResolvedValue('file content');

      const result = await service.downloadFile(1, 'onedrive', 'file-id-123');

      expect(result).toEqual({ content: 'file content' });
      expect(oneDriveProvider.downloadFile).toHaveBeenCalledWith('access-token', 'file-id-123');
    });
  });

  describe('token refresh', () => {
    it('should refresh expired token and retry', async () => {
      const expiredTime = String(Date.now() - 120000); // expired 2 minutes ago
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_access_token') return { value: service['encrypt']('old-access') };
        if (where.key === 'cloud_google_drive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_google_drive_expires_at') return { value: expiredTime };
        return null;
      });

      googleDriveProvider.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      });
      settingRepository.upsert.mockResolvedValue({});

      googleDriveProvider.listFiles.mockResolvedValue([]);

      const result = await service.listFiles(1, 'google_drive');

      expect(result).toEqual([]);
      expect(googleDriveProvider.refreshAccessToken).toHaveBeenCalledWith('refresh-token');
      expect(googleDriveProvider.listFiles).toHaveBeenCalledWith('new-access');
    });

    it('should clear tokens and throw when refresh fails', async () => {
      const expiredTime = String(Date.now() - 120000);
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_access_token') return { value: service['encrypt']('old-access') };
        if (where.key === 'cloud_google_drive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_google_drive_expires_at') return { value: expiredTime };
        return null;
      });

      googleDriveProvider.refreshAccessToken.mockRejectedValue(new Error('invalid_grant'));
      settingRepository.delete.mockResolvedValue({});

      await expect(service.listFiles(1, 'google_drive')).rejects.toThrow(BadRequestException);
      expect(settingRepository.delete).toHaveBeenCalled();
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt values consistently', () => {
      const original = 'my-secret-token-12345';
      const encrypted = service['encrypt'](original);
      const decrypted = service['decrypt'](encrypted);

      expect(encrypted).not.toBe(original);
      expect(encrypted).toContain(':');
      expect(decrypted).toBe(original);
    });

    it('should return empty string for invalid encrypted data', () => {
      expect(service['decrypt']('invalid')).toBe('');
      expect(service['decrypt']('')).toBe('');
      expect(service['decrypt']('a:b')).toBe('');
    });
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

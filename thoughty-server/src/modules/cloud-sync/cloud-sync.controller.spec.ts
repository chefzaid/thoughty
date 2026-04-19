import { Test, TestingModule } from '@nestjs/testing';
import { CloudSyncController } from './cloud-sync.controller';
import { CloudSyncService } from './cloud-sync.service';

describe('CloudSyncController', () => {
  let controller: CloudSyncController;
  let cloudSyncService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    cloudSyncService = {
      getStatus: jest.fn(),
      getAuthUrl: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      listFiles: jest.fn(),
      uploadExport: jest.fn(),
      downloadFile: jest.fn(),
      getSyncSchedules: jest.fn(),
      setSyncSchedule: jest.fn(),
      deleteSyncSchedule: jest.fn(),
      executeDiffSync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CloudSyncController],
      providers: [
        { provide: CloudSyncService, useValue: cloudSyncService },
      ],
    }).compile();

    controller = module.get<CloudSyncController>(CloudSyncController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return status for all providers', async () => {
      const mockStatus = {
        google_drive: { connected: true, connectedAt: '2024-01-01' },
        onedrive: { connected: false },
      };
      cloudSyncService.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockUser as any);

      expect(result).toEqual(mockStatus);
      expect(cloudSyncService.getStatus).toHaveBeenCalledWith(1);
    });
  });

  describe('getAuthUrl', () => {
    it('should return auth URL with generated state', async () => {
      cloudSyncService.getAuthUrl.mockResolvedValue({ url: 'https://auth.example.com' });

      const result = await controller.getAuthUrl({ provider: 'google_drive', redirectUri: 'http://localhost/callback' });

      expect(result).toEqual({ url: 'https://auth.example.com' });
      expect(cloudSyncService.getAuthUrl).toHaveBeenCalledWith(
        'google_drive',
        'http://localhost/callback',
        expect.any(String),
      );
    });
  });

  describe('connect', () => {
    it('should connect provider with code', async () => {
      cloudSyncService.connect.mockResolvedValue({ success: true, connectedAt: '2024-01-01' });

      const result = await controller.connect(mockUser as any, {
        provider: 'google_drive',
        code: 'auth-code',
        redirectUri: 'http://localhost/callback',
      });

      expect(result).toEqual({ success: true, connectedAt: '2024-01-01' });
      expect(cloudSyncService.connect).toHaveBeenCalledWith(1, 'google_drive', 'auth-code', 'http://localhost/callback');
    });
  });

  describe('disconnect', () => {
    it('should disconnect provider', async () => {
      cloudSyncService.disconnect.mockResolvedValue({ success: true });

      const result = await controller.disconnect(mockUser as any, { provider: 'onedrive' });

      expect(result).toEqual({ success: true });
      expect(cloudSyncService.disconnect).toHaveBeenCalledWith(1, 'onedrive');
    });
  });

  describe('listFiles', () => {
    it('should list files for provider', async () => {
      const mockFiles = [{ id: '1', name: 'file.txt', size: 100, modifiedAt: '2024-01-01' }];
      cloudSyncService.listFiles.mockResolvedValue(mockFiles);

      const result = await controller.listFiles(mockUser as any, { provider: 'google_drive' });

      expect(result).toEqual(mockFiles);
      expect(cloudSyncService.listFiles).toHaveBeenCalledWith(1, 'google_drive');
    });
  });

  describe('upload', () => {
    it('should upload export to cloud', async () => {
      const mockFile = { id: '1', name: 'export.txt', size: 100, modifiedAt: '2024-01-01' };
      cloudSyncService.uploadExport.mockResolvedValue(mockFile);

      const result = await controller.upload(mockUser as any, {
        provider: 'google_drive',
        format: 'txt',
        includeVisibility: true,
      });

      expect(result).toEqual(mockFile);
      expect(cloudSyncService.uploadExport).toHaveBeenCalledWith(1, 'google_drive', undefined, 'txt', true);
    });
  });

  describe('download', () => {
    it('should download file from cloud', async () => {
      cloudSyncService.downloadFile.mockResolvedValue({ content: 'file content' });

      const result = await controller.download(mockUser as any, {
        provider: 'onedrive',
        fileId: 'file-123',
      });

      expect(result).toEqual({ content: 'file content' });
      expect(cloudSyncService.downloadFile).toHaveBeenCalledWith(1, 'onedrive', 'file-123');
    });
  });

  describe('getSchedules', () => {
    it('should return sync schedules for all providers', async () => {
      const mockSchedules = {
        google_drive: { enabled: true, frequency: 'daily', format: 'txt' },
        onedrive: { enabled: false },
      };
      cloudSyncService.getSyncSchedules.mockResolvedValue(mockSchedules);

      const result = await controller.getSchedules(mockUser as any);

      expect(result).toEqual(mockSchedules);
      expect(cloudSyncService.getSyncSchedules).toHaveBeenCalledWith(1);
    });
  });

  describe('setSchedule', () => {
    it('should set sync schedule for a provider', async () => {
      cloudSyncService.setSyncSchedule.mockResolvedValue({ success: true });

      const result = await controller.setSchedule(mockUser as any, {
        provider: 'google_drive',
        frequency: 'daily',
        format: 'json',
        diaryId: 5,
        includeVisibility: true,
      });

      expect(result).toEqual({ success: true });
      expect(cloudSyncService.setSyncSchedule).toHaveBeenCalledWith(1, 'google_drive', 'daily', 'json', 5, true);
    });
  });

  describe('deleteSchedule', () => {
    it('should delete sync schedule for a provider', async () => {
      cloudSyncService.deleteSyncSchedule.mockResolvedValue({ success: true });

      const result = await controller.deleteSchedule(mockUser as any, { provider: 'onedrive' });

      expect(result).toEqual({ success: true });
      expect(cloudSyncService.deleteSyncSchedule).toHaveBeenCalledWith(1, 'onedrive');
    });
  });

  describe('triggerSync', () => {
    it('should trigger diff sync and return result', async () => {
      const mockResult = {
        synced: true,
        message: 'Sync completed successfully',
        file: { id: '1', name: 'export.txt', size: 100, modifiedAt: '2024-01-01' },
      };
      cloudSyncService.executeDiffSync.mockResolvedValue(mockResult);

      const result = await controller.triggerSync(mockUser as any, { provider: 'google_drive' });

      expect(result).toEqual(mockResult);
      expect(cloudSyncService.executeDiffSync).toHaveBeenCalledWith(1, 'google_drive');
    });

    it('should return no-changes result when nothing changed', async () => {
      const mockResult = {
        synced: false,
        message: 'No changes detected since last sync',
      };
      cloudSyncService.executeDiffSync.mockResolvedValue(mockResult);

      const result = await controller.triggerSync(mockUser as any, { provider: 'onedrive' });

      expect(result.synced).toBe(false);
    });
  });
});

import { BadRequestException } from '@nestjs/common';
import { CloudSyncService } from './cloud-sync.service';
import { createCloudSyncTestBed } from './cloud-sync.test-helpers';

describe('CloudSyncService', () => {
  let service: CloudSyncService;
  let settingRepository: any;
  let ioService: any;
  let googleDriveProvider: any;
  let oneDriveProvider: any;

  beforeEach(async () => {
    ({ service, settingRepository, ioService, googleDriveProvider, oneDriveProvider } = await createCloudSyncTestBed());
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  describe('uploadFile', () => {
    it('uploads generated binary content without converting it to text', async () => {
      const futureExpiry = String(Date.now() + 3600000);
      settingRepository.findOne.mockImplementation(({ where }: any) => {
        if (where.key === 'cloud_google_drive_access_token') return { value: service['encrypt']('access-token') };
        if (where.key === 'cloud_google_drive_refresh_token') return { value: service['encrypt']('refresh-token') };
        if (where.key === 'cloud_google_drive_expires_at') return { value: futureExpiry };
        return null;
      });
      const content = Buffer.from([0, 255, 1, 2]);
      const file = { content, filename: 'book.pdf', contentType: 'application/pdf' };
      const uploaded = { id: 'book-1', name: 'book.pdf', size: 4, modifiedAt: '2026-07-23' };
      googleDriveProvider.uploadFile.mockResolvedValue(uploaded);

      await expect(service.uploadFile(1, 'google_drive', file)).resolves.toBe(uploaded);
      expect(googleDriveProvider.uploadFile).toHaveBeenCalledWith(
        'access-token',
        'book.pdf',
        content,
        'application/pdf',
      );
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
});

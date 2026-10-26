import { BadRequestException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { CloudSyncService } from './cloud-sync.service';
import { createCloudSyncTestBed } from './cloud-sync.test-helpers';

describe('CloudSyncService', () => {
  let service: CloudSyncService;
  let settingRepository: any;
  let googleDriveProvider: any;
  let oneDriveProvider: any;

  beforeEach(async () => {
    ({ service, settingRepository, googleDriveProvider, oneDriveProvider } = await createCloudSyncTestBed());
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
      await expectApiError(service.getAuthUrl('icloud' as any, 'http://localhost/callback', 'state'), BadRequestException, 'CLOUD_UNKNOWN_PROVIDER');
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

      await expectApiError(service.listFiles(1, 'google_drive'), BadRequestException, 'CLOUD_CONNECTION_EXPIRED');
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
});

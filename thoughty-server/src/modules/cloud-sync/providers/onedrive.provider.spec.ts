import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { OneDriveProvider } from './onedrive.provider';

// Mock global fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('OneDriveProvider', () => {
  let provider: OneDriveProvider;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue: string) => {
        if (key === 'ONEDRIVE_CLIENT_ID') return 'test-client-id';
        if (key === 'ONEDRIVE_CLIENT_SECRET') return 'test-client-secret';
        return defaultValue;
      }),
    };

    provider = new OneDriveProvider(configService as ConfigService);
    jest.clearAllMocks();
    jest.spyOn((provider as any).logger, 'error').mockImplementation();
  });

  describe('getAuthUrl', () => {
    it('should generate correct OAuth URL', () => {
      const url = provider.getAuthUrl('http://localhost/callback', 'state123');

      expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=state123');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange code for tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'access-123',
          refresh_token: 'refresh-123',
          expires_in: 3600,
        }),
      });

      const result = await provider.exchangeCode('auth-code', 'http://localhost/callback');

      expect(result.accessToken).toBe('access-123');
      expect(result.refreshToken).toBe('refresh-123');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should throw when token exchange fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid_grant: code bad-code' });

      await expectApiError(
        provider.exchangeCode('bad-code', 'http://localhost/callback'),
        BadRequestException,
        'CLOUD_AUTHORIZATION_REJECTED',
      );
      expect((provider as any).logger.error).not.toHaveBeenCalledWith(expect.stringContaining('bad-code'));
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh the access token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
      });

      const result = await provider.refreshAccessToken('old-refresh');

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
    });

    it('should keep original refresh token when new one is not returned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          expires_in: 3600,
        }),
      });

      const result = await provider.refreshAccessToken('old-refresh');

      expect(result.refreshToken).toBe('old-refresh');
    });

    it('should throw when refresh fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid_grant' });

      await expectApiError(provider.refreshAccessToken('bad-refresh'), BadRequestException, 'CLOUD_CONNECTION_EXPIRED');
    });

    it('should report a provider failure, not an expired connection, when the refresh is refused for another reason', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid_client' });

      await expectApiError(provider.refreshAccessToken('refresh-123'), BadGatewayException, 'CLOUD_PROVIDER_FAILED');
    });
  });

  describe('listFiles', () => {
    it('should list files in the app folder', async () => {
      mockFetch
        // Check if folder exists
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'folder-id' }),
        })
        // List files
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [
              { id: 'file1', name: 'export.txt', size: 1024, lastModifiedDateTime: '2024-01-01T00:00:00Z' },
            ],
          }),
        });

      const files = await provider.listFiles('access-token');

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        id: 'file1',
        name: 'export.txt',
        size: 1024,
        modifiedAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should create folder if it does not exist', async () => {
      mockFetch
        // Folder not found
        .mockResolvedValueOnce({ ok: false })
        // Create folder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'new-folder-id' }),
        })
        // List files
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [] }),
        });

      const files = await provider.listFiles('access-token');

      expect(files).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('uploadFile', () => {
    it('should upload a file to the app folder', async () => {
      mockFetch
        // getOrCreateAppFolder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'folder-id' }),
        })
        // Upload
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'new-file-id',
            name: 'export.txt',
            size: 100,
            lastModifiedDateTime: '2024-01-01',
          }),
        });

      const binaryContent = Buffer.from([0, 255, 1, 2]);
      const result = await provider.uploadFile('access-token', 'export.pdf', binaryContent, 'application/pdf');

      expect(result.id).toBe('new-file-id');
      expect(result.name).toBe('export.txt');
      expect(Buffer.from(mockFetch.mock.calls[1][1]?.body as ArrayBuffer)).toEqual(binaryContent);
    });

    it('should throw when upload fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'folder-id' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'upload error',
        });

      await expectApiError(
        provider.uploadFile('access-token', 'export.txt', 'content', 'text/plain'),
        BadGatewayException,
        'CLOUD_PROVIDER_FAILED',
      );
      expect((provider as any).logger.error).not.toHaveBeenCalledWith(expect.stringContaining('upload error'));
    });
  });

  describe('downloadFile', () => {
    it('should download file content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'downloaded content',
      });

      const content = await provider.downloadFile('access-token', 'file-123');

      expect(content).toBe('downloaded content');
    });

    it('should throw when download fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expectApiError(provider.downloadFile('access-token', 'bad-id'), BadGatewayException, 'CLOUD_PROVIDER_FAILED');
    });

    it('should report an expired connection when the access token is refused', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      await expectApiError(provider.downloadFile('revoked-token', 'file-1'), BadRequestException, 'CLOUD_CONNECTION_EXPIRED');
    });
  });

  describe('unreachable provider', () => {
    it('should report a failed file list as a provider failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 503, text: async () => 'service unavailable' });

      await expectApiError(provider.listFiles('access-token'), BadGatewayException, 'CLOUD_PROVIDER_FAILED');
    });
  });
});

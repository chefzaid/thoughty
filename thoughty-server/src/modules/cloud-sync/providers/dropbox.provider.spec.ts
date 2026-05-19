import { ConfigService } from '@nestjs/config';
import { DropboxProvider } from './dropbox.provider';

// Mock global fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('DropboxProvider', () => {
  let provider: DropboxProvider;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue: string) => {
        if (key === 'DROPBOX_CLIENT_ID') return 'test-client-id';
        if (key === 'DROPBOX_CLIENT_SECRET') return 'test-client-secret';
        return defaultValue;
      }),
    };

    provider = new DropboxProvider(configService as ConfigService);
    jest.clearAllMocks();
    jest.spyOn((provider as any).logger, 'error').mockImplementation();
  });

  describe('getAuthUrl', () => {
    it('should generate correct OAuth URL', () => {
      const url = provider.getAuthUrl('http://localhost/callback', 'state123');

      expect(url).toContain('https://www.dropbox.com/oauth2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('token_access_type=offline');
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
          expires_in: 14400,
        }),
      });

      const result = await provider.exchangeCode('auth-code', 'http://localhost/callback');

      expect(result.accessToken).toBe('access-123');
      expect(result.refreshToken).toBe('refresh-123');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dropboxapi.com/oauth2/token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should throw when token exchange fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: async () => 'error' });

      await expect(
        provider.exchangeCode('bad-code', 'http://localhost/callback'),
      ).rejects.toThrow('Failed to exchange authorization code');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh the access token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          expires_in: 14400,
        }),
      });

      const result = await provider.refreshAccessToken('refresh-123');

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('refresh-123'); // Dropbox keeps original refresh token
    });

    it('should throw when refresh fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: async () => 'invalid_grant' });

      await expect(
        provider.refreshAccessToken('bad-refresh'),
      ).rejects.toThrow('Failed to refresh access token');
    });
  });

  describe('listFiles', () => {
    it('should list files in the app folder', async () => {
      // First call: check if folder exists (ensureAppFolder)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ '.tag': 'folder', name: 'Thoughty' }),
        })
        // Second call: list files
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            entries: [
              { '.tag': 'file', id: 'id:file1', name: 'export.txt', size: 1024, server_modified: '2024-01-01T00:00:00Z' },
            ],
          }),
        });

      const files = await provider.listFiles('access-token');

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        id: 'id:file1',
        name: 'export.txt',
        size: 1024,
        modifiedAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should filter out folders from listing', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ '.tag': 'folder' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            entries: [
              { '.tag': 'file', id: 'id:file1', name: 'export.txt', size: 100, server_modified: '2024-01-01' },
              { '.tag': 'folder', id: 'id:folder1', name: 'subfolder' },
            ],
          }),
        });

      const files = await provider.listFiles('access-token');

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('export.txt');
    });
  });

  describe('uploadFile', () => {
    it('should upload a file', async () => {
      mockFetch
        // ensureAppFolder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ '.tag': 'folder' }),
        })
        // upload
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'id:new-file',
            name: 'export.txt',
            size: 100,
            server_modified: '2024-01-01',
          }),
        });

      const result = await provider.uploadFile('access-token', 'export.txt', 'content', 'text/plain');

      expect(result.id).toBe('id:new-file');
      expect(result.name).toBe('export.txt');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://content.dropboxapi.com/2/files/upload',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
          }),
        }),
      );
    });

    it('should throw when upload fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ '.tag': 'folder' }),
        })
        .mockResolvedValueOnce({ ok: false, text: async () => 'upload error' });

      await expect(
        provider.uploadFile('access-token', 'export.txt', 'content', 'text/plain'),
      ).rejects.toThrow('Failed to upload file');
    });
  });

  describe('downloadFile', () => {
    it('should download file content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'downloaded content',
      });

      const content = await provider.downloadFile('access-token', 'id:file-123');

      expect(content).toBe('downloaded content');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://content.dropboxapi.com/2/files/download',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Dropbox-API-Arg': JSON.stringify({ path: 'id:file-123' }),
          }),
        }),
      );
    });

    it('should throw when download fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(
        provider.downloadFile('access-token', 'bad-id'),
      ).rejects.toThrow('Failed to download file');
    });
  });
});

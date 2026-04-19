import { ConfigService } from '@nestjs/config';
import { GoogleDriveProvider } from './google-drive.provider';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GoogleDriveProvider', () => {
  let provider: GoogleDriveProvider;
  let configService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue: string) => {
        if (key === 'GOOGLE_DRIVE_CLIENT_ID') return 'test-client-id';
        if (key === 'GOOGLE_DRIVE_CLIENT_SECRET') return 'test-client-secret';
        return defaultValue;
      }),
    };

    provider = new GoogleDriveProvider(configService as ConfigService);
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should generate correct OAuth URL', () => {
      const url = provider.getAuthUrl('http://localhost/callback', 'state123');

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('access_type=offline');
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
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
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
          expires_in: 3600,
        }),
      });

      const result = await provider.refreshAccessToken('refresh-123');

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('refresh-123'); // Google keeps original refresh token
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
      // First call: search for existing folder
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [{ id: 'folder-id', name: 'Thoughty' }] }),
        })
        // Second call: list files in folder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [
              { id: 'file1', name: 'export.txt', size: '1024', modifiedTime: '2024-01-01T00:00:00Z' },
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
        // Search returns empty
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        })
        // Create folder
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'new-folder-id' }),
        })
        // List files
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        });

      const files = await provider.listFiles('access-token');

      expect(files).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('uploadFile', () => {
    it('should upload a new file', async () => {
      mockFetch
        // getOrCreateAppFolder - search
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [{ id: 'folder-id' }] }),
        })
        // Search for existing file
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        })
        // Upload
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'new-file-id',
            name: 'export.txt',
            size: '100',
            modifiedTime: '2024-01-01',
          }),
        });

      const result = await provider.uploadFile('access-token', 'export.txt', 'content', 'text/plain');

      expect(result.id).toBe('new-file-id');
      expect(result.name).toBe('export.txt');
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
      mockFetch.mockResolvedValue({ ok: false });

      await expect(
        provider.downloadFile('access-token', 'bad-id'),
      ).rejects.toThrow('Failed to download file');
    });
  });
});

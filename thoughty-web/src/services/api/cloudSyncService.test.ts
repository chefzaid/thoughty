import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCloudSyncService } from './cloudSyncService';

type Service = ReturnType<typeof createCloudSyncService>;

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const expiredConnection = {
  statusCode: 400,
  message: 'google drive connection expired. Please reconnect.',
  error: 'Bad Request',
  code: 'CLOUD_CONNECTION_EXPIRED',
};

const file = { id: 'f1', name: 'export.txt', size: 1024, modifiedAt: '2024-01-01' };

/** Every call, with the request it should send, what the API answers, and what the call resolves to. */
const calls: ReadonlyArray<{
  name: string;
  call: (service: Service) => Promise<unknown>;
  request: unknown[];
  answer: unknown;
  data: unknown;
  fallback: string;
}> = [
  {
    name: 'getStatus',
    call: (service) => service.getStatus(),
    request: ['/api/cloud-sync/status'],
    answer: { google_drive: { connected: true, connectedAt: '2024-01-01' } },
    data: { google_drive: { connected: true, connectedAt: '2024-01-01' } },
    fallback: 'Failed to load cloud status',
  },
  {
    name: 'getAuthUrl',
    call: (service) => service.getAuthUrl('google_drive', 'http://localhost/cloud-callback'),
    request: ['/api/cloud-sync/auth-url', {
      method: 'POST',
      body: JSON.stringify({ provider: 'google_drive', redirectUri: 'http://localhost/cloud-callback' }),
    }],
    answer: { url: 'https://accounts.google.com/oauth' },
    data: 'https://accounts.google.com/oauth',
    fallback: 'cloudConnectError',
  },
  {
    name: 'connect',
    call: (service) => service.connect('dropbox', 'auth-code', 'http://localhost/cloud-callback'),
    request: ['/api/cloud-sync/connect', {
      method: 'POST',
      body: JSON.stringify({ provider: 'dropbox', code: 'auth-code', redirectUri: 'http://localhost/cloud-callback' }),
    }],
    answer: { success: true, connectedAt: '2024-01-01' },
    data: { success: true, connectedAt: '2024-01-01' },
    fallback: 'cloudConnectError',
  },
  {
    name: 'disconnect',
    call: (service) => service.disconnect('onedrive'),
    request: ['/api/cloud-sync/disconnect', { method: 'POST', body: JSON.stringify({ provider: 'onedrive' }) }],
    answer: { success: true },
    data: { success: true },
    fallback: 'cloudDisconnectError',
  },
  {
    name: 'listFiles',
    call: (service) => service.listFiles('google_drive'),
    request: ['/api/cloud-sync/files?provider=google_drive'],
    answer: [file],
    data: [file],
    fallback: 'cloudListFilesError',
  },
  {
    name: 'uploadExport',
    call: (service) => service.uploadExport('google_drive', { diaryId: 2, format: 'json', includeVisibility: true }),
    request: ['/api/cloud-sync/upload', {
      method: 'POST',
      body: JSON.stringify({ provider: 'google_drive', diaryId: 2, format: 'json', includeVisibility: true }),
    }],
    answer: file,
    data: file,
    fallback: 'cloudUploadError',
  },
  {
    name: 'downloadFile',
    call: (service) => service.downloadFile('dropbox', 'f1'),
    request: ['/api/cloud-sync/download', { method: 'POST', body: JSON.stringify({ provider: 'dropbox', fileId: 'f1' }) }],
    answer: { content: '--- 2024-01-15 --\nHello' },
    data: '--- 2024-01-15 --\nHello',
    fallback: 'cloudDownloadError',
  },
  {
    name: 'getSchedules',
    call: (service) => service.getSchedules(),
    request: ['/api/cloud-sync/schedules'],
    answer: { google_drive: { enabled: true, frequency: 'daily' } },
    data: { google_drive: { enabled: true, frequency: 'daily' } },
    fallback: 'Failed to load sync schedules',
  },
  {
    name: 'setSchedule',
    call: (service) => service.setSchedule('google_drive', { frequency: 'weekly', format: 'md', diaryId: 1, includeVisibility: false }),
    request: ['/api/cloud-sync/schedule', {
      method: 'POST',
      body: JSON.stringify({ provider: 'google_drive', frequency: 'weekly', format: 'md', diaryId: 1, includeVisibility: false }),
    }],
    answer: { success: true },
    data: { success: true },
    fallback: 'cloudScheduleSaveError',
  },
  {
    name: 'deleteSchedule',
    call: (service) => service.deleteSchedule('onedrive'),
    request: ['/api/cloud-sync/schedule?provider=onedrive', { method: 'DELETE' }],
    answer: { success: true },
    data: { success: true },
    fallback: 'cloudScheduleRemoveError',
  },
  {
    name: 'triggerSync',
    call: (service) => service.triggerSync('google_drive'),
    request: ['/api/cloud-sync/sync', { method: 'POST', body: JSON.stringify({ provider: 'google_drive' }) }],
    answer: { synced: true, message: 'Synced', file },
    data: { synced: true, message: 'Synced', file },
    fallback: 'cloudSyncError',
  },
];

describe('cloudSyncService', () => {
  let authFetch: ReturnType<typeof vi.fn>;
  let service: Service;

  beforeEach(() => {
    authFetch = vi.fn();
    service = createCloudSyncService(authFetch as Parameters<typeof createCloudSyncService>[0]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each(calls)('$name', ({ call, request, answer, data, fallback }) => {
    it('sends the request and resolves to the data', async () => {
      authFetch.mockResolvedValue(jsonResponse(answer));

      await expect(call(service)).resolves.toEqual({ data, error: null });
      expect(authFetch).toHaveBeenCalledWith(...request);
    });

    it('passes the API’s coded reason on', async () => {
      authFetch.mockResolvedValue(jsonResponse(expiredConnection, 400));

      await expect(call(service)).resolves.toEqual({ data: null, error: 'apiError_CLOUD_CONNECTION_EXPIRED' });
    });

    it('falls back to its own message when the API gives no reason', async () => {
      authFetch.mockResolvedValue(jsonResponse({ statusCode: 503 }, 503));

      await expect(call(service)).resolves.toEqual({ data: null, error: fallback });
    });

    it('falls back to its own message when the request cannot be sent', async () => {
      authFetch.mockRejectedValue(new Error('network error'));

      await expect(call(service)).resolves.toEqual({ data: null, error: fallback });
    });
  });

  it.each([
    ['getAuthUrl', (s: Service) => s.getAuthUrl('google_drive', 'http://localhost/cloud-callback'), 'cloudConnectError'],
    ['downloadFile', (s: Service) => s.downloadFile('google_drive', 'f1'), 'cloudDownloadError'],
  ] as const)('%s falls back to its own message when the answer has nothing in it', async (_name, call, fallback) => {
    authFetch.mockResolvedValue(jsonResponse({}));

    await expect(call(service)).resolves.toEqual({ data: null, error: fallback });
  });
});

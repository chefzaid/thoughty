import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCloudSync } from './useCloudSync';

const mockCloudSyncService = {
    getStatus: vi.fn(),
    getAuthUrl: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    listFiles: vi.fn(),
    uploadExport: vi.fn(),
    downloadFile: vi.fn(),
    getSchedules: vi.fn(),
    setSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    triggerSync: vi.fn(),
};

const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useAppState', () => ({
    useApiServices: () => ({ cloudSyncService: mockCloudSyncService }),
}));

vi.mock('../../utils/downloadFile', () => ({ downloadBlob }));

const t = (key: string, params?: Record<string, string | number>): string => (
    params ? `${key}:${JSON.stringify(params)}` : key
);

const file = { id: 'f1', name: 'export.txt', size: 10, modifiedAt: '2024-01-01T00:00:00Z' };

async function renderCloudSync(diaryId: number | null = null) {
    const hook = renderHook(() => useCloudSync(t, diaryId));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
}

function postOAuthMessage(data: unknown) {
    act(() => {
        globalThis.dispatchEvent(new MessageEvent('message', { data }));
    });
}

describe('useCloudSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCloudSyncService.getStatus.mockResolvedValue({ google_drive: { connected: true } });
        mockCloudSyncService.getSchedules.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('keeps the default schedule form when the saved schedules cannot be read', async () => {
        const { result } = await renderCloudSync();

        expect(result.current.schedules).toEqual({});
        expect(result.current.scheduleFrequency.google_drive).toBe('daily');
        expect(result.current.scheduleFormat.google_drive).toBe('txt');
        expect(result.current.scheduleIncludeVisibility.google_drive).toBe(false);
    });

    it('fills the schedule form from the saved schedules', async () => {
        mockCloudSyncService.getSchedules.mockResolvedValue({
            dropbox: { enabled: true, frequency: 'weekly', format: 'md', includeVisibility: true },
            onedrive: { enabled: false },
        });

        const { result } = await renderCloudSync();

        await waitFor(() => expect(result.current.scheduleFrequency.dropbox).toBe('weekly'));
        expect(result.current.scheduleFormat.dropbox).toBe('md');
        expect(result.current.scheduleIncludeVisibility.dropbox).toBe(true);
        expect(result.current.scheduleFrequency.onedrive).toBe('daily');
    });

    it('connects a provider when the OAuth popup posts its code', async () => {
        mockCloudSyncService.connect.mockResolvedValue(true);
        const { result } = await renderCloudSync();

        postOAuthMessage({ type: 'cloud-oauth-callback', provider: 'dropbox', code: 'abc' });

        await waitFor(() => expect(result.current.message?.type).toBe('success'));
        expect(mockCloudSyncService.connect).toHaveBeenCalledWith('dropbox', 'abc', `${globalThis.location.origin}/cloud-callback`);
        expect(result.current.message?.text).toBe('cloudConnected:{"provider":"Dropbox"}');
        expect(result.current.connecting).toBeNull();
        expect(mockCloudSyncService.getStatus).toHaveBeenCalledTimes(2);
    });

    it('names an unknown provider by its key after the OAuth popup connects it', async () => {
        mockCloudSyncService.connect.mockResolvedValue(true);
        const { result } = await renderCloudSync();

        postOAuthMessage({ type: 'cloud-oauth-callback', provider: 'box', code: 'abc' });

        await waitFor(() => expect(result.current.message?.text).toBe('cloudConnected:{"provider":"box"}'));
    });

    it('reports a failed OAuth connection', async () => {
        mockCloudSyncService.connect.mockResolvedValue(false);
        const { result } = await renderCloudSync();

        postOAuthMessage({ type: 'cloud-oauth-callback', provider: 'dropbox', code: 'abc' });

        await waitFor(() => expect(result.current.message).toEqual({ type: 'error', text: 'cloudConnectError' }));
        expect(result.current.connecting).toBeNull();
    });

    it('ignores other messages and OAuth messages without a provider or code', async () => {
        await renderCloudSync();

        postOAuthMessage({ type: 'other' });
        postOAuthMessage(null);
        postOAuthMessage({ type: 'cloud-oauth-callback', provider: 'dropbox' });
        postOAuthMessage({ type: 'cloud-oauth-callback', code: 'abc' });

        expect(mockCloudSyncService.connect).not.toHaveBeenCalled();
    });

    it('stops listening for OAuth messages when unmounted', async () => {
        const { unmount } = await renderCloudSync();
        unmount();

        postOAuthMessage({ type: 'cloud-oauth-callback', provider: 'dropbox', code: 'abc' });

        expect(mockCloudSyncService.connect).not.toHaveBeenCalled();
    });

    it('hides a message after a few seconds and replaces an earlier one', async () => {
        mockCloudSyncService.setSchedule.mockResolvedValue(false);
        mockCloudSyncService.deleteSchedule.mockResolvedValue(false);
        const { result, unmount } = await renderCloudSync();
        vi.useFakeTimers();

        await act(async () => {
            await result.current.handleSaveSchedule('google_drive');
        });
        expect(result.current.message).toEqual({ type: 'error', text: 'cloudScheduleSaveError' });

        act(() => {
            vi.advanceTimersByTime(2000);
        });
        await act(async () => {
            await result.current.handleRemoveSchedule('google_drive');
        });
        expect(result.current.message).toEqual({ type: 'error', text: 'cloudScheduleRemoveError' });

        act(() => {
            vi.advanceTimersByTime(3000);
        });
        expect(result.current.message).not.toBeNull();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current.message).toBeNull();

        await act(async () => {
            await result.current.handleSaveSchedule('google_drive');
        });
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('saves a schedule with the default frequency for a provider without one', async () => {
        mockCloudSyncService.setSchedule.mockResolvedValue(true);
        const { result } = await renderCloudSync(4);

        act(() => {
            result.current.setScheduleFrequency({});
        });
        await act(async () => {
            await result.current.handleSaveSchedule('google_drive');
        });

        expect(mockCloudSyncService.setSchedule).toHaveBeenCalledWith('google_drive', {
            frequency: 'daily',
            format: 'txt',
            diaryId: 4,
            includeVisibility: false,
        });
    });

    it('reports a sync with no file name', async () => {
        mockCloudSyncService.triggerSync.mockResolvedValue({ synced: true, message: 'ok' });
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleSyncNow('google_drive');
        });

        expect(result.current.message?.text).toBe('cloudSyncSuccess:{"name":""}');
        expect(result.current.syncing).toBeNull();
    });

    it('opens the OAuth popup centred on the window', async () => {
        mockCloudSyncService.getAuthUrl.mockResolvedValue('https://auth.example/authorize');
        const open = vi.spyOn(globalThis, 'open').mockReturnValue(null);
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleConnect('onedrive');
        });

        expect(open).toHaveBeenCalledWith('https://auth.example/authorize', 'cloud-oauth', expect.stringContaining('width=600,height=700'));
        expect(result.current.connecting).toBe('onedrive');
        open.mockRestore();
    });

    it('reports a provider whose sign-in link cannot be created', async () => {
        mockCloudSyncService.getAuthUrl.mockResolvedValue(null);
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleConnect('onedrive');
        });

        expect(result.current.message).toEqual({ type: 'error', text: 'cloudConnectError' });
        expect(result.current.connecting).toBeNull();
    });

    it('closes the file list of a provider that is disconnected', async () => {
        mockCloudSyncService.listFiles.mockResolvedValue([file]);
        mockCloudSyncService.disconnect.mockResolvedValue(true);
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleBrowseFiles('google_drive');
        });
        expect(result.current.files).toEqual([file]);

        await act(async () => {
            await result.current.handleDisconnect('dropbox');
        });
        expect(result.current.expandedProvider).toBe('google_drive');

        await act(async () => {
            await result.current.handleDisconnect('google_drive');
        });
        expect(result.current.expandedProvider).toBeNull();
        expect(result.current.files).toEqual([]);
    });

    it('reports a failed disconnect', async () => {
        mockCloudSyncService.disconnect.mockResolvedValue(false);
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleDisconnect('google_drive');
        });

        expect(result.current.message).toEqual({ type: 'error', text: 'cloudDisconnectError' });
    });

    it('refreshes the open file list after an upload to the same provider', async () => {
        mockCloudSyncService.listFiles.mockResolvedValueOnce([]).mockResolvedValueOnce([file]);
        mockCloudSyncService.uploadExport.mockResolvedValue(file);
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleBrowseFiles('google_drive');
        });
        await act(async () => {
            await result.current.handleUpload('google_drive');
        });

        expect(result.current.files).toEqual([file]);
        expect(mockCloudSyncService.listFiles).toHaveBeenCalledTimes(2);
        expect(result.current.uploading).toBeNull();
    });

    it('toggles the file list closed when browsing the open provider again', async () => {
        mockCloudSyncService.listFiles.mockResolvedValue([file]);
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleBrowseFiles('google_drive');
        });
        await act(async () => {
            await result.current.handleBrowseFiles('google_drive');
        });

        expect(result.current.expandedProvider).toBeNull();
        expect(result.current.files).toEqual([]);
        expect(mockCloudSyncService.listFiles).toHaveBeenCalledTimes(1);
    });

    it('saves a downloaded file to the device', async () => {
        mockCloudSyncService.downloadFile.mockResolvedValue('hello');
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleDownload('google_drive', file);
        });

        expect(mockCloudSyncService.downloadFile).toHaveBeenCalledWith('google_drive', 'f1');
        expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'export.txt');
        expect(result.current.message?.text).toBe('cloudDownloadSuccess:{"name":"export.txt"}');
        expect(result.current.downloading).toBeNull();
    });

    it('reports a failed download', async () => {
        mockCloudSyncService.downloadFile.mockResolvedValue(null);
        const { result } = await renderCloudSync();

        await act(async () => {
            await result.current.handleDownload('google_drive', file);
        });

        expect(downloadBlob).not.toHaveBeenCalled();
        expect(result.current.message).toEqual({ type: 'error', text: 'cloudDownloadError' });
    });
});

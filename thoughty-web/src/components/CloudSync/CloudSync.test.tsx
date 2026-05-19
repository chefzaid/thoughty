import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CloudSync from './CloudSync';

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

vi.mock('../../hooks/useAppState', () => ({
    useApiServices: () => ({ cloudSyncService: mockCloudSyncService }),
}));

const mockT = (key: string): string => key;

describe('CloudSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: false },
            onedrive: { connected: false },
            dropbox: { connected: false },
        });
        mockCloudSyncService.getSchedules.mockResolvedValue({
            google_drive: { enabled: false },
            onedrive: { enabled: false },
            dropbox: { enabled: false },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders loading state initially', () => {
        mockCloudSyncService.getStatus.mockReturnValue(new Promise(() => {})); // never resolves
        mockCloudSyncService.getSchedules.mockReturnValue(new Promise(() => {})); // never resolves
        render(<CloudSync theme="dark" t={mockT} />);

        expect(screen.getByText('loading...')).toBeInTheDocument();
    });

    it('renders provider cards after loading', async () => {
        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudSync')).toBeInTheDocument();
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
            expect(screen.getByText('OneDrive')).toBeInTheDocument();
            expect(screen.getByText('Dropbox')).toBeInTheDocument();
        });
    });

    it('shows connect buttons for disconnected providers', async () => {
        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            const connectButtons = screen.getAllByText('cloudConnect');
            expect(connectButtons).toHaveLength(3);
        });
    });

    it('shows action buttons for connected provider', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudUpload')).toBeInTheDocument();
            expect(screen.getByText('cloudBrowseFiles')).toBeInTheDocument();
            expect(screen.getByText('cloudDisconnect')).toBeInTheDocument();
        });
    });

    it('shows upload options for connected provider', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudUploadOptions')).toBeInTheDocument();
            expect(screen.getAllByText('exportFormat').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('initiates OAuth flow on connect', async () => {
        const openSpy = vi.spyOn(globalThis, 'open').mockImplementation(() => null);
        mockCloudSyncService.getAuthUrl.mockResolvedValue('https://accounts.google.com/oauth');

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getAllByText('cloudConnect')).toHaveLength(3);
        });

        fireEvent.click(screen.getAllByText('cloudConnect')[0]);

        await waitFor(() => {
            expect(mockCloudSyncService.getAuthUrl).toHaveBeenCalledWith('google_drive', expect.stringContaining('/cloud-callback'));
            expect(openSpy).toHaveBeenCalled();
        });

        openSpy.mockRestore();
    });

    it('handles disconnect', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.disconnect.mockResolvedValue(true);

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudDisconnect')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudDisconnect'));

        await waitFor(() => {
            expect(mockCloudSyncService.disconnect).toHaveBeenCalledWith('google_drive');
        });
    });

    it('handles upload', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.uploadExport.mockResolvedValue({ id: '1', name: 'export.txt', size: 100, modifiedAt: '2024-01-01' });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudUpload')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudUpload'));

        await waitFor(() => {
            expect(mockCloudSyncService.uploadExport).toHaveBeenCalledWith('google_drive', {
                diaryId: undefined,
                format: 'txt',
                includeVisibility: false,
            });
        });
    });

    it('handles upload with diary ID and options', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.uploadExport.mockResolvedValue({ id: '1', name: 'export.json', size: 100, modifiedAt: '2024-01-01' });

        render(<CloudSync theme="dark" t={mockT} diaryId={5} diaryName="Work" />);

        await waitFor(() => {
            expect(screen.getByText('cloudUpload')).toBeInTheDocument();
        });

        // Change format to JSON (first format select is for upload options)
        const formatSelects = screen.getAllByDisplayValue('formatTxt');
        fireEvent.change(formatSelects[0], { target: { value: 'json' } });

        // Toggle includeVisibility (first checkbox is for upload options)
        const checkboxes = screen.getAllByText('includeVisibility');
        fireEvent.click(checkboxes[0]);

        fireEvent.click(screen.getByText('cloudUpload'));

        await waitFor(() => {
            expect(mockCloudSyncService.uploadExport).toHaveBeenCalledWith('google_drive', {
                diaryId: 5,
                format: 'json',
                includeVisibility: true,
            });
        });
    });

    it('browses files in cloud storage', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.listFiles.mockResolvedValue([
            { id: 'f1', name: 'export.txt', size: 1024, modifiedAt: '2024-01-01T00:00:00Z' },
        ]);

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudBrowseFiles')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudBrowseFiles'));

        await waitFor(() => {
            expect(mockCloudSyncService.listFiles).toHaveBeenCalledWith('google_drive');
            expect(screen.getByText('export.txt')).toBeInTheDocument();
        });
    });

    it('shows empty state when no files', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.listFiles.mockResolvedValue([]);

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudBrowseFiles')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudBrowseFiles'));

        await waitFor(() => {
            expect(screen.getByText('cloudNoFiles')).toBeInTheDocument();
        });
    });

    it('shows success message on upload', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.uploadExport.mockResolvedValue({ id: '1', name: 'export.txt', size: 100, modifiedAt: '2024-01-01' });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudUpload')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudUpload'));

        await waitFor(() => {
            expect(screen.getByText('cloudUploadSuccess')).toBeInTheDocument();
        });
    });

    it('shows error message on failed upload', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.uploadExport.mockResolvedValue(null);

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudUpload')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudUpload'));

        await waitFor(() => {
            expect(screen.getByText('cloudUploadError')).toBeInTheDocument();
        });
    });

    it('applies light theme class', async () => {
        const { container } = render(<CloudSync theme="light" t={mockT} />);

        await waitFor(() => {
            expect(container.querySelector('.cloud-sync.light')).toBeTruthy();
        });
    });

    it('shows connected status text', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-15T10:30:00Z' },
            onedrive: { connected: false },
        });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudStatusConnected')).toBeInTheDocument();
        });
    });

    it('shows schedule section for connected provider', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudSchedule')).toBeInTheDocument();
            expect(screen.getByText('cloudScheduleDescription')).toBeInTheDocument();
            expect(screen.getByText('cloudScheduleEnable')).toBeInTheDocument();
            expect(screen.getByText('cloudSyncNow')).toBeInTheDocument();
        });
    });

    it('shows schedule status when enabled', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.getSchedules.mockResolvedValue({
            google_drive: {
                enabled: true,
                frequency: 'daily',
                format: 'txt',
                lastSyncAt: '2024-06-01T12:00:00Z',
                nextSyncAt: '2024-06-02T12:00:00Z',
            },
            onedrive: { enabled: false },
        });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudScheduleEnabled')).toBeInTheDocument();
            expect(screen.getByText('cloudScheduleDisable')).toBeInTheDocument();
        });
    });

    it('saves sync schedule on enable', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.setSchedule.mockResolvedValue(true);

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudScheduleEnable')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudScheduleEnable'));

        await waitFor(() => {
            expect(mockCloudSyncService.setSchedule).toHaveBeenCalledWith('google_drive', {
                frequency: 'daily',
                format: 'txt',
                diaryId: undefined,
                includeVisibility: false,
            });
        });
    });

    it('removes sync schedule on disable', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.getSchedules.mockResolvedValue({
            google_drive: { enabled: true, frequency: 'daily', format: 'txt' },
            onedrive: { enabled: false },
        });
        mockCloudSyncService.deleteSchedule.mockResolvedValue(true);

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudScheduleDisable')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudScheduleDisable'));

        await waitFor(() => {
            expect(mockCloudSyncService.deleteSchedule).toHaveBeenCalledWith('google_drive');
        });
    });

    it('triggers sync now and shows success', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.triggerSync.mockResolvedValue({
            synced: true,
            message: 'Sync completed successfully',
            file: { id: '1', name: 'export.txt', size: 100, modifiedAt: '2024-01-01' },
        });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudSyncNow')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudSyncNow'));

        await waitFor(() => {
            expect(mockCloudSyncService.triggerSync).toHaveBeenCalledWith('google_drive');
            expect(screen.getByText('cloudSyncSuccess')).toBeInTheDocument();
        });
    });

    it('shows no-changes message when sync detects no diff', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.triggerSync.mockResolvedValue({
            synced: false,
            message: 'No changes detected since last sync',
        });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudSyncNow')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudSyncNow'));

        await waitFor(() => {
            expect(screen.getByText('cloudSyncNoChanges')).toBeInTheDocument();
        });
    });

    it('shows error message on failed sync', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });
        mockCloudSyncService.triggerSync.mockResolvedValue(null);

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudSyncNow')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudSyncNow'));

        await waitFor(() => {
            expect(screen.getByText('cloudSyncError')).toBeInTheDocument();
        });
    });

    it('does not show schedule section for disconnected provider', async () => {
        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.queryByText('cloudSchedule')).not.toBeInTheDocument();
        });
    });

    it('shows frequency selector in schedule section', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
        });

        render(<CloudSync theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudScheduleFrequency')).toBeInTheDocument();
            expect(screen.getByText('cloudScheduleEvery6h')).toBeInTheDocument();
            expect(screen.getByText('cloudScheduleDaily')).toBeInTheDocument();
            expect(screen.getByText('cloudScheduleWeekly')).toBeInTheDocument();
        });
    });
});

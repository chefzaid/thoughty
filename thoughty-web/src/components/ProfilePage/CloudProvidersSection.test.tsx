import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CloudProvidersSection from './CloudProvidersSection';

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

describe('CloudProvidersSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: false },
            onedrive: { connected: false },
            dropbox: { connected: false },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders section title', async () => {
        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getByText('cloudProviders')).toBeInTheDocument();
        });
    });

    it('renders description text', async () => {
        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getByText('cloudProvidersDescription')).toBeInTheDocument();
        });
    });

    it('renders all three providers', async () => {
        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getByText('Google Drive')).toBeInTheDocument();
            expect(screen.getByText('OneDrive')).toBeInTheDocument();
            expect(screen.getByText('Dropbox')).toBeInTheDocument();
        });
    });

    it('shows connect buttons for disconnected providers', async () => {
        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            const connectButtons = screen.getAllByText('cloudConnect');
            expect(connectButtons).toHaveLength(3);
        });
    });

    it('shows disconnect button for connected providers', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        });

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getByText('cloudDisconnect')).toBeInTheDocument();
            expect(screen.getAllByText('cloudConnect')).toHaveLength(2);
        });
    });

    it('opens OAuth popup when connect is clicked', async () => {
        const mockOpen = vi.fn();
        globalThis.open = mockOpen;
        mockCloudSyncService.getAuthUrl.mockResolvedValue('https://accounts.google.com/oauth');

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getAllByText('cloudConnect')).toHaveLength(3);
        });

        fireEvent.click(screen.getAllByText('cloudConnect')[0]);

        await waitFor(() => {
            expect(mockCloudSyncService.getAuthUrl).toHaveBeenCalledWith(
                'google_drive',
                expect.stringContaining('/cloud-callback')
            );
            expect(mockOpen).toHaveBeenCalledWith(
                'https://accounts.google.com/oauth',
                'cloud-oauth',
                expect.stringContaining('width=600')
            );
        });
    });

    it('shows error when auth URL fails', async () => {
        mockCloudSyncService.getAuthUrl.mockResolvedValue(null);

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getAllByText('cloudConnect')).toHaveLength(3);
        });

        fireEvent.click(screen.getAllByText('cloudConnect')[0]);

        await waitFor(() => {
            expect(screen.getByText('cloudConnectError')).toBeInTheDocument();
        });
    });

    it('disconnects a provider', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        });
        mockCloudSyncService.disconnect.mockResolvedValue(true);

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getByText('cloudDisconnect')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudDisconnect'));

        await waitFor(() => {
            expect(mockCloudSyncService.disconnect).toHaveBeenCalledWith('google_drive');
            expect(screen.getByText('cloudDisconnected')).toBeInTheDocument();
        });
    });

    it('shows error when disconnect fails', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        });
        mockCloudSyncService.disconnect.mockResolvedValue(false);

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getByText('cloudDisconnect')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudDisconnect'));

        await waitFor(() => {
            expect(screen.getByText('cloudDisconnectError')).toBeInTheDocument();
        });
    });

    it('handles OAuth callback via postMessage', async () => {
        mockCloudSyncService.connect.mockResolvedValue(true);
        mockCloudSyncService.getStatus
            .mockResolvedValueOnce({
                google_drive: { connected: false },
                onedrive: { connected: false },
                dropbox: { connected: false },
            })
            .mockResolvedValueOnce({
                google_drive: { connected: true, connectedAt: '2024-01-15' },
                onedrive: { connected: false },
                dropbox: { connected: false },
            });

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getAllByText('cloudConnect')).toHaveLength(3);
        });

        // Simulate OAuth callback
        globalThis.dispatchEvent(new MessageEvent('message', {
            data: { type: 'cloud-oauth-callback', provider: 'google_drive', code: 'auth-code-123' },
        }));

        await waitFor(() => {
            expect(mockCloudSyncService.connect).toHaveBeenCalledWith(
                'google_drive',
                'auth-code-123',
                expect.stringContaining('/cloud-callback')
            );
        });
    });

    it('renders in dark mode', async () => {
        render(<CloudProvidersSection t={mockT} isDark={true} />);

        await waitFor(() => {
            expect(screen.getByText('cloudProviders')).toBeInTheDocument();
        });
    });
});

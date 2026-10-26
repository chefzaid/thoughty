import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import CloudProvidersSection from './CloudProvidersSection';
import { cloudOk, cloudRefused } from '../../services/api/cloudSyncService.test-helpers';
import { getTranslation } from '../../utils/translations';

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
        mockCloudSyncService.getStatus.mockResolvedValue(cloudOk({
            google_drive: { connected: false },
            onedrive: { connected: false },
            dropbox: { connected: false },
        }));
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
        mockCloudSyncService.getStatus.mockResolvedValue(cloudOk({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        }));

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getByText('cloudDisconnect')).toBeInTheDocument();
            expect(screen.getAllByText('cloudConnect')).toHaveLength(2);
        });
    });

    it('opens OAuth popup when connect is clicked', async () => {
        const mockOpen = vi.fn();
        globalThis.open = mockOpen;
        mockCloudSyncService.getAuthUrl.mockResolvedValue(cloudOk('https://accounts.google.com/oauth'));

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getAllByText('cloudConnect')).toHaveLength(3);
        });

        fireEvent.click(screen.getAllByText('cloudConnect')[0]!);

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
        mockCloudSyncService.getAuthUrl.mockResolvedValue(cloudRefused('getAuthUrl'));

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getAllByText('cloudConnect')).toHaveLength(3);
        });

        fireEvent.click(screen.getAllByText('cloudConnect')[0]!);

        await waitFor(() => {
            expect(screen.getByText('cloudConnectError')).toBeInTheDocument();
        });
    });

    it('disconnects a provider', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue(cloudOk({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        }));
        mockCloudSyncService.disconnect.mockResolvedValue(cloudOk({ success: true }));

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
        mockCloudSyncService.getStatus.mockResolvedValue(cloudOk({
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        }));
        mockCloudSyncService.disconnect.mockResolvedValue(cloudRefused('disconnect'));

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
        mockCloudSyncService.connect.mockResolvedValue(cloudOk({ success: true }));
        mockCloudSyncService.getStatus
            .mockResolvedValueOnce(cloudOk({
                google_drive: { connected: false },
                onedrive: { connected: false },
                dropbox: { connected: false },
            }))
            .mockResolvedValueOnce(cloudOk({
                google_drive: { connected: true, connectedAt: '2024-01-15' },
                onedrive: { connected: false },
                dropbox: { connected: false },
            }));

        render(<CloudProvidersSection t={mockT} isDark={false} />);

        await waitFor(() => {
            expect(screen.getAllByText('cloudConnect')).toHaveLength(3);
        });

        // Simulate OAuth callback
        await act(async () => {
            globalThis.dispatchEvent(new MessageEvent('message', {
                data: { type: 'cloud-oauth-callback', provider: 'google_drive', code: 'auth-code-123' },
            }));
        });

        await waitFor(() => {
            expect(mockCloudSyncService.connect).toHaveBeenCalledWith(
                'google_drive',
                'auth-code-123',
                expect.stringContaining('/cloud-callback')
            );
        });
    });

    it.each([
        ['connection', 'connect', 'apiError_CLOUD_UNKNOWN_PROVIDER', 'Ce service cloud n’est pas pris en charge.'],
        ['disconnection', 'disconnect', 'apiError_RATE_LIMITED', 'Trop de tentatives. Patientez un instant et réessayez.'],
    ] as const)('shows the reason a refused %s gives, in French', async (_action, call, error, expected) => {
        const t = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
        mockCloudSyncService.getStatus.mockResolvedValue(cloudOk({
            google_drive: { connected: call === 'disconnect' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        }));
        mockCloudSyncService[call].mockResolvedValue(cloudRefused(call, error));
        render(<CloudProvidersSection t={t} isDark={false} />);
        await screen.findByText('Google Drive');

        if (call === 'connect') {
            await act(async () => {
                globalThis.dispatchEvent(new MessageEvent('message', {
                    data: { type: 'cloud-oauth-callback', provider: 'google_drive', code: 'auth-code-123' },
                }));
            });
        } else {
            fireEvent.click(await screen.findByText(t('cloudDisconnect')));
        }

        expect(await screen.findByText(expected)).toBeInTheDocument();
        expect(screen.queryByText(t('cloudConnectError'))).not.toBeInTheDocument();
    });

    it('renders in dark mode', async () => {
        render(<CloudProvidersSection t={mockT} isDark={true} />);

        await waitFor(() => {
            expect(screen.getByText('cloudProviders')).toBeInTheDocument();
        });
    });
});

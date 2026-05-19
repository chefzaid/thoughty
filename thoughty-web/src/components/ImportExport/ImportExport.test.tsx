import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportExport from './ImportExport';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return {
        useAuth: () => ({ authFetch })
    };
});

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

const mockFormatConfig = {
    entrySeparator: '--------------------------------------------------------------------------------',
    sameDaySeparator: '********************************************************************************',
    datePrefix: '---',
    dateSuffix: '--',
    dateFormat: 'YYYY-MM-DD',
    tagOpenBracket: '[',
    tagCloseBracket: ']',
    tagSeparator: ','
};

describe('ImportExport', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
        globalThis.URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        mockCloudSyncService.getStatus.mockResolvedValue({});
        mockCloudSyncService.getSchedules.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders sections after loading', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

        render(<ImportExport theme="dark" t={mockT} diaryId={null} diaryName="Personal" />);

        await waitFor(() => {
            expect(screen.getByText('importExport')).toBeInTheDocument();
            expect(screen.getByText('export')).toBeInTheDocument();
            expect(screen.getByText('import')).toBeInTheDocument();
            expect(screen.getByText('formatSettings')).toBeInTheDocument();
            expect(screen.getByText('dangerZone')).toBeInTheDocument();
        });
    });

    it('saves format settings', async () => {
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('saveFormat')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('saveFormat'));

        await waitFor(() => {
            const calls = (globalThis.fetch as Mock).mock.calls.filter((c: unknown[]) => c[0] === '/api/io/format');
            expect(calls.length).toBeGreaterThan(1);
            expect((calls[1] as [string, RequestInit])[1]?.method).toBe('POST');
        });
    });

    it('exports entries', async () => {
        const mockBlob = new Blob(['data'], { type: 'text/plain' });
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({
                ok: true,
                blob: async () => mockBlob,
                headers: new Headers({ 'Content-Disposition': 'attachment; filename="export.txt"' })
            });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('downloadExport')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('downloadExport'));

        await waitFor(() => {
            const exportCall = (globalThis.fetch as Mock).mock.calls.find((c: unknown[]) => (c[0] as string).includes('/api/io/export'));
            expect(exportCall).toBeTruthy();
        });
    });

    it('previews and imports file content', async () => {
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ totalCount: 3, duplicateCount: 1 }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ importedCount: 2, skippedCount: 1 }) });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('chooseFile')).toBeInTheDocument();
        });

        const input = document.querySelector('#file-input') as HTMLInputElement;
        // Create a mock file with text() method since jsdom doesn't support it
        const mockFile = {
            name: 'test.txt',
            type: 'text/plain',
            size: 12,
            text: async () => 'file content',
        } as unknown as File;
        
        Object.defineProperty(input, 'files', {
            value: [mockFile],
            writable: false,
        });
        fireEvent.change(input);

        await waitFor(() => {
            expect(screen.getByText('previewSummary')).toBeInTheDocument();
            expect(screen.getByText('skipDuplicates')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('confirmImport'));

        await waitFor(() => {
            const importCall = (globalThis.fetch as Mock).mock.calls.find((c: unknown[]) => c[0] === '/api/io/import');
            expect(importCall).toBeTruthy();
        });
    });

    it('includes includeVisibility param when checkbox is checked', async () => {
        const mockBlob = new Blob(['data'], { type: 'text/plain' });
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({
                ok: true,
                blob: async () => mockBlob,
                headers: new Headers({ 'Content-Disposition': 'attachment; filename="export.txt"' })
            });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('includeVisibilityShort')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('includeVisibilityShort'));
        fireEvent.click(screen.getByText('downloadExport'));

        await waitFor(() => {
            const exportCall = (globalThis.fetch as Mock).mock.calls.find((c: unknown[]) => (c[0] as string).includes('/api/io/export'));
            expect(exportCall).toBeTruthy();
            expect((exportCall as [string])[0]).toContain('includeVisibility=true');
        });
    });

    it('includes format param when JSON format is selected', async () => {
        const mockBlob = new Blob(['{}'], { type: 'application/json' });
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({
                ok: true,
                blob: async () => mockBlob,
                headers: new Headers({ 'Content-Disposition': 'attachment; filename="export.json"' })
            });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('exportFormat')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByDisplayValue('formatTxt'), { target: { value: 'json' } });
        fireEvent.click(screen.getByText('downloadExport'));

        await waitFor(() => {
            const exportCall = (globalThis.fetch as Mock).mock.calls.find((c: unknown[]) => (c[0] as string).includes('/api/io/export'));
            expect(exportCall).toBeTruthy();
            expect((exportCall as [string])[0]).toContain('format=json');
        });
    });

    it('handles delete all confirmation and delete', async () => {
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('deleteAllEntries')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('deleteAllEntries'));
        await waitFor(() => {
            expect(screen.getByText('confirmDeleteAll')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('confirmDeleteAll'));
        await waitFor(() => {
            const deleteCall = (globalThis.fetch as Mock).mock.calls.find((c: unknown[]) => (c[0] as string).includes('/api/entries/all'));
            expect((deleteCall as [string, RequestInit] | undefined)?.[1]?.method).toBe('DELETE');
        });
    });

    it('cancels delete all when cancel is clicked', async () => {
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('deleteAllEntries')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('deleteAllEntries'));
        await waitFor(() => {
            expect(screen.getByText('confirmDeleteAll')).toBeInTheDocument();
            expect(screen.getByText('cancel')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cancel'));
        await waitFor(() => {
            expect(screen.getByText('deleteAllEntries')).toBeInTheDocument();
            expect(screen.queryByText('confirmDeleteAll')).not.toBeInTheDocument();
        });
    });

    it('renders in light theme', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

        render(<ImportExport theme="light" t={mockT} />);

        await waitFor(() => {
            const container = screen.getByText('importExport').closest('.import-export');
            expect(container).toHaveClass('light');
        });
    });

    it('shows loading state when format config is being fetched', () => {
        (globalThis.fetch as Mock).mockReturnValue(new Promise(() => {}));
        mockCloudSyncService.getStatus.mockReturnValue(new Promise(() => {}));
        mockCloudSyncService.getSchedules.mockReturnValue(new Promise(() => {}));

        render(<ImportExport theme="dark" t={mockT} />);

        expect(screen.getByText('loading...')).toBeInTheDocument();
    });

    describe('Cloud Sync Section', () => {
        const connectedStatus = {
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        };

        const renderWithConnectedProvider = async () => {
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} diaryId={1} diaryName="Personal" />);

            await waitFor(() => {
                expect(screen.getByText('cloudSync')).toBeInTheDocument();
            });
        };

        it('shows cloud sync section when a provider is connected', async () => {
            await renderWithConnectedProvider();

            expect(screen.getAllByText('Google Drive').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('cloudUpload')).toBeInTheDocument();
        });

        it('hides cloud sync section when no providers are connected', async () => {
            mockCloudSyncService.getStatus.mockResolvedValue({
                google_drive: { connected: false },
                onedrive: { connected: false },
                dropbox: { connected: false },
            });
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('importExport')).toBeInTheDocument();
            });

            expect(screen.queryByText('cloudSync')).not.toBeInTheDocument();
        });

        it('uploads export to cloud provider', async () => {
            await renderWithConnectedProvider();

            mockCloudSyncService.uploadExport.mockResolvedValue({
                id: '1', name: 'export_2024-01-01.txt', size: 500, modifiedAt: '2024-01-01',
            });

            fireEvent.click(screen.getByText('cloudUpload'));

            await waitFor(() => {
                expect(mockCloudSyncService.uploadExport).toHaveBeenCalledWith('google_drive', {
                    diaryId: 1,
                    format: 'txt',
                    includeVisibility: false,
                });
                expect(screen.getByText('cloudUploadSuccess')).toBeInTheDocument();
            });
        });

        it('shows error when cloud upload fails', async () => {
            await renderWithConnectedProvider();

            mockCloudSyncService.uploadExport.mockResolvedValue(null);

            fireEvent.click(screen.getByText('cloudUpload'));

            await waitFor(() => {
                expect(screen.getByText('cloudUploadError')).toBeInTheDocument();
            });
        });

        it('saves a sync schedule', async () => {
            await renderWithConnectedProvider();

            mockCloudSyncService.setSchedule.mockResolvedValue(true);
            mockCloudSyncService.getSchedules.mockResolvedValue({
                google_drive: { enabled: true, frequency: 'daily' },
            });

            fireEvent.click(screen.getByText('cloudScheduleEnable'));

            await waitFor(() => {
                expect(mockCloudSyncService.setSchedule).toHaveBeenCalledWith('google_drive', {
                    frequency: 'daily',
                    format: 'txt',
                    diaryId: 1,
                    includeVisibility: false,
                });
                expect(screen.getByText('cloudScheduleSaved')).toBeInTheDocument();
            });
        });

        it('shows error when saving schedule fails', async () => {
            await renderWithConnectedProvider();

            mockCloudSyncService.setSchedule.mockResolvedValue(false);

            fireEvent.click(screen.getByText('cloudScheduleEnable'));

            await waitFor(() => {
                expect(screen.getByText('cloudScheduleSaveError')).toBeInTheDocument();
            });
        });

        it('removes a sync schedule', async () => {
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({
                google_drive: { enabled: true, frequency: 'daily', lastSyncAt: '2024-06-01T12:00:00Z', nextSyncAt: '2024-06-02T12:00:00Z' },
            });
            mockCloudSyncService.deleteSchedule.mockResolvedValue(true);
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('cloudScheduleDisable')).toBeInTheDocument();
            });

            // Also verify schedule status indicators are shown
            expect(screen.getByText('cloudScheduleEnabled')).toBeInTheDocument();

            fireEvent.click(screen.getByText('cloudScheduleDisable'));

            await waitFor(() => {
                expect(mockCloudSyncService.deleteSchedule).toHaveBeenCalledWith('google_drive');
                expect(screen.getByText('cloudScheduleRemoved')).toBeInTheDocument();
            });
        });

        it('shows error when removing schedule fails', async () => {
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({
                google_drive: { enabled: true, frequency: 'daily' },
            });
            mockCloudSyncService.deleteSchedule.mockResolvedValue(false);
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('cloudScheduleDisable')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('cloudScheduleDisable'));

            await waitFor(() => {
                expect(screen.getByText('cloudScheduleRemoveError')).toBeInTheDocument();
            });
        });

        it('triggers sync now for a provider', async () => {
            await renderWithConnectedProvider();

            mockCloudSyncService.triggerSync.mockResolvedValue({
                synced: true,
                message: 'Sync completed',
                file: { id: '1', name: 'export.txt', size: 100, modifiedAt: '2024-01-01' },
            });

            fireEvent.click(screen.getByText('cloudSyncNow'));

            await waitFor(() => {
                expect(mockCloudSyncService.triggerSync).toHaveBeenCalledWith('google_drive');
                expect(screen.getByText('cloudSyncSuccess')).toBeInTheDocument();
            });
        });

        it('shows no-changes message when sync detects no diff', async () => {
            await renderWithConnectedProvider();

            mockCloudSyncService.triggerSync.mockResolvedValue({
                synced: false,
                message: 'No changes',
            });

            fireEvent.click(screen.getByText('cloudSyncNow'));

            await waitFor(() => {
                expect(screen.getByText('cloudSyncNoChanges')).toBeInTheDocument();
            });
        });

        it('shows error when sync fails', async () => {
            await renderWithConnectedProvider();

            mockCloudSyncService.triggerSync.mockResolvedValue(null);

            fireEvent.click(screen.getByText('cloudSyncNow'));

            await waitFor(() => {
                expect(screen.getByText('cloudSyncError')).toBeInTheDocument();
            });
        });

        it('shows multiple connected providers in cloud sync', async () => {
            mockCloudSyncService.getStatus.mockResolvedValue({
                google_drive: { connected: true, connectedAt: '2024-01-01' },
                onedrive: { connected: true, connectedAt: '2024-02-01' },
                dropbox: { connected: false },
            });
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getAllByText('Google Drive').length).toBeGreaterThanOrEqual(1);
                expect(screen.getAllByText('OneDrive').length).toBeGreaterThanOrEqual(1);
            });

            const uploadButtons = screen.getAllByText('cloudUpload');
            expect(uploadButtons).toHaveLength(2);
        });
    });

    describe('Cloud File Import', () => {
        const connectedStatus = {
            google_drive: { connected: true, connectedAt: '2024-01-01' },
            onedrive: { connected: false },
            dropbox: { connected: false },
        };

        it('shows cloud import section when providers are connected', async () => {
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('cloudImportFromCloud')).toBeInTheDocument();
                expect(screen.getByText('cloudSelectFileToImport')).toBeInTheDocument();
            });
        });

        it('browses cloud files when provider button is clicked', async () => {
            const mockFiles = [
                { id: 'f1', name: 'journal_2024-01-01.txt', size: 2048, modifiedAt: '2024-01-15T10:30:00Z' },
                { id: 'f2', name: 'journal_2024-02-01.json', size: 5120, modifiedAt: '2024-02-15T14:00:00Z' },
            ];
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            mockCloudSyncService.listFiles.mockResolvedValue(mockFiles);
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('cloudImportFromCloud')).toBeInTheDocument();
            });

            // Click the Google Drive button to browse files
            const providerButtons = screen.getAllByText(/Google Drive/);
            fireEvent.click(providerButtons[0]);

            await waitFor(() => {
                expect(mockCloudSyncService.listFiles).toHaveBeenCalledWith('google_drive');
                expect(screen.getByText('journal_2024-01-01.txt')).toBeInTheDocument();
                expect(screen.getByText('journal_2024-02-01.json')).toBeInTheDocument();
            });
        });

        it('shows empty state when no cloud files exist', async () => {
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            mockCloudSyncService.listFiles.mockResolvedValue([]);
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('cloudImportFromCloud')).toBeInTheDocument();
            });

            const providerButtons = screen.getAllByText(/Google Drive/);
            fireEvent.click(providerButtons[0]);

            await waitFor(() => {
                expect(screen.getByText('cloudNoFiles')).toBeInTheDocument();
            });
        });

        it('toggles cloud file list off when clicking the same provider again', async () => {
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            mockCloudSyncService.listFiles.mockResolvedValue([
                { id: 'f1', name: 'test.txt', size: 100, modifiedAt: '2024-01-01' },
            ]);
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('cloudImportFromCloud')).toBeInTheDocument();
            });

            const providerButtons = screen.getAllByText(/Google Drive/);
            fireEvent.click(providerButtons[0]);

            await waitFor(() => {
                expect(screen.getByText('test.txt')).toBeInTheDocument();
            });

            // Click again to close
            fireEvent.click(providerButtons[0]);

            await waitFor(() => {
                expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
            });
        });

        it('imports a cloud file and shows preview', async () => {
            const mockFiles = [
                { id: 'f1', name: 'journal.txt', size: 1024, modifiedAt: '2024-01-01' },
            ];
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            mockCloudSyncService.listFiles.mockResolvedValue(mockFiles);
            mockCloudSyncService.downloadFile.mockResolvedValue('downloaded file content');
            (globalThis.fetch as Mock)
                .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ totalCount: 5, duplicateCount: 0 }) });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('cloudImportFromCloud')).toBeInTheDocument();
            });

            const providerButtons = screen.getAllByText(/Google Drive/);
            fireEvent.click(providerButtons[0]);

            await waitFor(() => {
                expect(screen.getByText('journal.txt')).toBeInTheDocument();
            });

            // Click the import button on the file row (not the section heading)
            const importButtons = screen.getAllByText('import');
            const fileImportButton = importButtons.find(el => el.tagName === 'BUTTON');
            expect(fileImportButton).toBeDefined();
            if (!fileImportButton) {
                throw new Error('Expected a file import button in the cloud file row');
            }
            fireEvent.click(fileImportButton);

            await waitFor(() => {
                expect(mockCloudSyncService.downloadFile).toHaveBeenCalledWith('google_drive', 'f1');
                expect(screen.getByText('cloudDownloadSuccess')).toBeInTheDocument();
                expect(screen.getByText('previewSummary')).toBeInTheDocument();
            });
        });

        it('shows error when cloud file download fails', async () => {
            const mockFiles = [
                { id: 'f1', name: 'journal.txt', size: 1024, modifiedAt: '2024-01-01' },
            ];
            mockCloudSyncService.getStatus.mockResolvedValue(connectedStatus);
            mockCloudSyncService.getSchedules.mockResolvedValue({});
            mockCloudSyncService.listFiles.mockResolvedValue(mockFiles);
            mockCloudSyncService.downloadFile.mockResolvedValue(null);
            (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

            render(<ImportExport theme="dark" t={mockT} />);

            await waitFor(() => {
                expect(screen.getByText('cloudImportFromCloud')).toBeInTheDocument();
            });

            const providerButtons = screen.getAllByText(/Google Drive/);
            fireEvent.click(providerButtons[0]);

            await waitFor(() => {
                expect(screen.getByText('journal.txt')).toBeInTheDocument();
            });

            const importButtons = screen.getAllByText('import');
            const fileImportButton = importButtons.find(el => el.tagName === 'BUTTON');
            expect(fileImportButton).toBeDefined();
            if (!fileImportButton) {
                throw new Error('Expected a file import button in the cloud file row');
            }
            fireEvent.click(fileImportButton);

            await waitFor(() => {
                expect(screen.getByText('cloudDownloadError')).toBeInTheDocument();
            });
        });
    });
});

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportExport from './ImportExport';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return {
        useAuth: () => ({ authFetch }),
    };
});

const mockCloudSyncService = {
    getStatus: vi.fn(),
    getSchedules: vi.fn(),
    uploadExport: vi.fn(),
    setSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    triggerSync: vi.fn(),
    listFiles: vi.fn(),
    downloadFile: vi.fn(),
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
    tagSeparator: ',',
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
            expect(screen.getByRole('heading', { name: 'export' })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'import' })).toBeInTheDocument();
            expect(screen.getByText('formatSettings')).toBeInTheDocument();
            expect(screen.getByText('dangerZone')).toBeInTheDocument();
        });
    });

    it('applies route-driven export presets from props', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

        render(
            <ImportExport
                theme="dark"
                t={mockT}
                initialSection="import"
                initialExportFormat="json"
                initialIncludeVisibility={true}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'import' })).toHaveClass('primary');
            expect(screen.getByDisplayValue('formatJson')).toBeInTheDocument();
        });

        expect((screen.getByLabelText('includeVisibilityShort') as HTMLInputElement).checked).toBe(true);
    });

    it('reports route state changes when presets are updated', async () => {
        const onRouteStateChange = vi.fn();
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

        render(<ImportExport theme="dark" t={mockT} onRouteStateChange={onRouteStateChange} />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'import' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'import' }));

        await waitFor(() => {
            expect(onRouteStateChange).toHaveBeenCalledWith({
                section: 'import',
                exportFormat: 'txt',
                includeVisibility: false,
            });
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
            const calls = (globalThis.fetch as Mock).mock.calls.filter((call: unknown[]) => call[0] === '/api/io/format');
            expect(calls.length).toBeGreaterThan(1);
            expect((calls[1] as [string, RequestInit])[1]?.method).toBe('POST');
        });
    });

    it('exports entries with the selected parameters', async () => {
        const mockBlob = new Blob(['{}'], { type: 'application/json' });
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({
                ok: true,
                blob: async () => mockBlob,
                headers: new Headers({ 'Content-Disposition': 'attachment; filename="export.json"' }),
            });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('exportFormat')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByDisplayValue('formatTxt'), { target: { value: 'json' } });
        fireEvent.click(screen.getByText('includeVisibilityShort'));
        fireEvent.click(screen.getByText('downloadExport'));

        await waitFor(() => {
            const exportCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => (call[0] as string).includes('/api/io/export'));
            expect(exportCall).toBeTruthy();
            expect((exportCall as [string])[0]).toContain('format=json');
            expect((exportCall as [string])[0]).toContain('includeVisibility=true');
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
            const importCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => call[0] === '/api/io/import');
            expect(importCall).toBeTruthy();
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
        fireEvent.click(screen.getByText('confirmDeleteAll'));

        await waitFor(() => {
            const deleteCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => (call[0] as string).includes('/api/entries/all'));
            expect((deleteCall as [string, RequestInit] | undefined)?.[1]?.method).toBe('DELETE');
        });
    });

    it('cancels delete all when cancel is clicked', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('deleteAllEntries')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('deleteAllEntries'));
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

    it('runs the successful cloud upload, schedule, remove, and sync flows', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });
        mockCloudSyncService.getStatus.mockResolvedValue({ google_drive: { connected: true } });
        mockCloudSyncService.getSchedules.mockResolvedValue({
            google_drive: { enabled: true, frequency: 'daily', format: 'txt', includeVisibility: false },
        });
        mockCloudSyncService.uploadExport.mockResolvedValue({ name: 'cloud.txt' });
        mockCloudSyncService.setSchedule.mockResolvedValue(true);
        mockCloudSyncService.deleteSchedule.mockResolvedValue(true);
        mockCloudSyncService.triggerSync.mockResolvedValue({ synced: true, file: { name: 'synced.txt' } });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudUpload')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudUpload'));
        fireEvent.click(screen.getByText('cloudScheduleEnable'));
        fireEvent.click(screen.getByText('cloudScheduleDisable'));
        fireEvent.click(screen.getByText('cloudSyncNow'));

        await waitFor(() => {
            expect(mockCloudSyncService.uploadExport).toHaveBeenCalledWith('google_drive', {
                diaryId: undefined,
                format: 'txt',
                includeVisibility: false,
            });
            expect(mockCloudSyncService.setSchedule).toHaveBeenCalledWith('google_drive', {
                diaryId: undefined,
                format: 'txt',
                frequency: 'daily',
                includeVisibility: false,
            });
            expect(mockCloudSyncService.deleteSchedule).toHaveBeenCalledWith('google_drive');
            expect(mockCloudSyncService.triggerSync).toHaveBeenCalledWith('google_drive');
            expect(screen.getByText('cloudSyncSuccess')).toBeInTheDocument();
        });

        expect(mockCloudSyncService.getSchedules.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('shows cloud error and no-change messages for unsuccessful cloud actions', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });
        mockCloudSyncService.getStatus.mockResolvedValue({ google_drive: { connected: true } });
        mockCloudSyncService.getSchedules.mockResolvedValue({
            google_drive: { enabled: true, frequency: 'daily', format: 'txt', includeVisibility: false },
        });
        mockCloudSyncService.uploadExport.mockResolvedValue(null);
        mockCloudSyncService.setSchedule.mockResolvedValue(false);
        mockCloudSyncService.deleteSchedule.mockResolvedValue(false);
        mockCloudSyncService.triggerSync.mockResolvedValue({ synced: false, file: null });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('cloudUpload')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('cloudUpload'));
        await screen.findByText('cloudUploadError');

        fireEvent.click(screen.getByText('cloudScheduleEnable'));
        await screen.findByText('cloudScheduleSaveError');

        fireEvent.click(screen.getByText('cloudScheduleDisable'));
        await screen.findByText('cloudScheduleRemoveError');

        fireEvent.click(screen.getByText('cloudSyncNow'));
        await screen.findByText('cloudSyncNoChanges');
    });

    it('lists cloud files, previews a downloaded cloud file, and toggles the browser closed', async () => {
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ totalCount: 1, duplicateCount: 0 }) });
        mockCloudSyncService.getStatus.mockResolvedValue({ google_drive: { connected: true } });
        mockCloudSyncService.getSchedules.mockResolvedValue({});
        mockCloudSyncService.listFiles.mockResolvedValue([
            { id: 'file-1', name: 'cloud-export.txt', size: 2048, modifiedAt: '2024-01-01T12:00:00.000Z' },
        ]);
        mockCloudSyncService.downloadFile.mockResolvedValue('cloud content');

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /Google Drive/ })[0]).toBeInTheDocument();
        });

        const openCloudBrowserButton = screen.getAllByRole('button', { name: /Google Drive/ }).at(0);
        if (!openCloudBrowserButton) {
            throw new Error('Expected Google Drive button to render');
        }

        fireEvent.click(openCloudBrowserButton);

        await waitFor(() => {
            expect(screen.getByText('cloud-export.txt')).toBeInTheDocument();
        });

        fireEvent.click(screen.getAllByRole('button', { name: 'import' }).at(-1) as HTMLElement);

        await waitFor(() => {
            const previewCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => call[0] === '/api/io/preview');
            expect(previewCall).toBeTruthy();
            expect((previewCall as [string, RequestInit])[1]?.body).toContain('cloud content');
            expect(screen.getByText('previewSummary')).toBeInTheDocument();
        });

        fireEvent.click(openCloudBrowserButton);

        await waitFor(() => {
            expect(screen.queryByText('cloud-export.txt')).not.toBeInTheDocument();
        });
    });

    it('shows an error when downloading a cloud file fails', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });
        mockCloudSyncService.getStatus.mockResolvedValue({ google_drive: { connected: true } });
        mockCloudSyncService.getSchedules.mockResolvedValue({});
        mockCloudSyncService.listFiles.mockResolvedValue([
            { id: 'file-1', name: 'cloud-export.txt', size: 2048, modifiedAt: '2024-01-01T12:00:00.000Z' },
        ]);
        mockCloudSyncService.downloadFile.mockResolvedValue(null);

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /Google Drive/ })[0]).toBeInTheDocument();
        });

        const cloudBrowserButton = screen.getAllByRole('button', { name: /Google Drive/ }).at(0);
        if (!cloudBrowserButton) {
            throw new Error('Expected Google Drive button to render');
        }

        fireEvent.click(cloudBrowserButton);
        await screen.findByText('cloud-export.txt');
        fireEvent.click(screen.getAllByRole('button', { name: 'import' }).at(-1) as HTMLElement);

        await screen.findByText('cloudDownloadError');
        expect(mockCloudSyncService.downloadFile).toHaveBeenCalledWith('google_drive', 'file-1');
    });

    it('handles failed save, export, preview, and delete flows', async () => {
        const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockRejectedValueOnce(new Error('save failed'))
            .mockRejectedValueOnce(new Error('export failed'))
            .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('saveFormat')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('saveFormat'));
        await screen.findByText('formatSaveError');

        fireEvent.click(screen.getByText('downloadExport'));
        await screen.findByText('exportError');

        const input = document.querySelector('#file-input') as HTMLInputElement;
        const brokenFile = {
            name: 'broken.txt',
            text: async () => {
                throw new Error('read failed');
            },
        } as unknown as File;

        Object.defineProperty(input, 'files', {
            value: [brokenFile],
            writable: false,
        });

        fireEvent.change(input);
        await screen.findByText('previewError');

        fireEvent.click(screen.getByText('deleteAllEntries'));
        fireEvent.click(screen.getByText('confirmDeleteAll'));

        await screen.findByText('deleteAllError');
        expect(mockConsoleError).toHaveBeenCalled();
    });
});
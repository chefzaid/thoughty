import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CloudImportSection, CloudSyncSection } from './ImportExportCloudSection';

const mockT = (key: string, params?: Record<string, string | number>): string => {
    if (key === 'cloudLastSync') {
        return `last:${params?.date}`;
    }
    if (key === 'cloudNextSync') {
        return `next:${params?.date}`;
    }
    return key;
};

describe('ImportExportCloudSection', () => {
    it('CloudImportSection hides when there are no connected providers', () => {
        const { container } = render(
            <CloudImportSection
                cloudLoading={false}
                connectedProviders={[]}
                cloudImportProvider={null}
                cloudFiles={[]}
                loadingCloudFiles={false}
                importingCloudFile={null}
                onBrowseCloudFiles={vi.fn()}
                onImportCloudFile={vi.fn()}
                t={mockT}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('CloudImportSection renders file browsing and import actions', () => {
        const onBrowseCloudFiles = vi.fn();
        const onImportCloudFile = vi.fn();
        const file = { id: 'f1', name: 'journal.txt', size: 1024, modifiedAt: '2024-01-01T12:00:00.000Z' };
        render(
            <CloudImportSection
                cloudLoading={false}
                connectedProviders={['google_drive']}
                cloudImportProvider="google_drive"
                cloudFiles={[file]}
                loadingCloudFiles={false}
                importingCloudFile={null}
                onBrowseCloudFiles={onBrowseCloudFiles}
                onImportCloudFile={onImportCloudFile}
                t={mockT}
            />,
        );

        fireEvent.click(screen.getByText(/Google Drive/));
        fireEvent.click(screen.getByText('import'));

        expect(onBrowseCloudFiles).toHaveBeenCalledWith('google_drive');
        expect(onImportCloudFile).toHaveBeenCalledWith('google_drive', file);
        expect(screen.getByText('journal.txt')).toBeInTheDocument();
    });

    it('CloudSyncSection hides when there are no connected providers', () => {
        const { container } = render(
            <CloudSyncSection
                connectedProviders={[]}
                schedules={{}}
                uploading={null}
                syncing={null}
                scheduleFrequency={{ google_drive: 'daily', onedrive: 'daily', dropbox: 'daily' }}
                setScheduleFrequency={vi.fn()}
                scheduleFormat={{ google_drive: 'txt', onedrive: 'txt', dropbox: 'txt' }}
                setScheduleFormat={vi.fn()}
                scheduleIncludeVisibility={{ google_drive: false, onedrive: false, dropbox: false }}
                setScheduleIncludeVisibility={vi.fn()}
                cloudExportFormat="txt"
                setCloudExportFormat={vi.fn()}
                cloudIncludeVisibility={false}
                setCloudIncludeVisibility={vi.fn()}
                onUpload={vi.fn()}
                onSaveSchedule={vi.fn()}
                onRemoveSchedule={vi.fn()}
                onSyncNow={vi.fn()}
                t={mockT}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('CloudSyncSection calls upload, schedule, remove, and sync handlers', () => {
        const onUpload = vi.fn();
        const onSaveSchedule = vi.fn();
        const onRemoveSchedule = vi.fn();
        const onSyncNow = vi.fn();
        render(
            <CloudSyncSection
                connectedProviders={['google_drive']}
                schedules={{
                    google_drive: { enabled: true, frequency: 'daily', lastSyncAt: '2024-01-01T12:00:00.000Z', nextSyncAt: '2024-01-02T12:00:00.000Z' },
                }}
                uploading={null}
                syncing={null}
                scheduleFrequency={{ google_drive: 'daily', onedrive: 'daily', dropbox: 'daily' }}
                setScheduleFrequency={vi.fn()}
                scheduleFormat={{ google_drive: 'txt', onedrive: 'txt', dropbox: 'txt' }}
                setScheduleFormat={vi.fn()}
                scheduleIncludeVisibility={{ google_drive: false, onedrive: false, dropbox: false }}
                setScheduleIncludeVisibility={vi.fn()}
                cloudExportFormat="txt"
                setCloudExportFormat={vi.fn()}
                cloudIncludeVisibility={false}
                setCloudIncludeVisibility={vi.fn()}
                onUpload={onUpload}
                onSaveSchedule={onSaveSchedule}
                onRemoveSchedule={onRemoveSchedule}
                onSyncNow={onSyncNow}
                t={mockT}
            />,
        );

        fireEvent.click(screen.getByText('cloudUpload'));
        fireEvent.click(screen.getByText('cloudScheduleEnable'));
        fireEvent.click(screen.getByText('cloudScheduleDisable'));
        fireEvent.click(screen.getByText('cloudSyncNow'));

        expect(onUpload).toHaveBeenCalledWith('google_drive');
        expect(onSaveSchedule).toHaveBeenCalledWith('google_drive');
        expect(onRemoveSchedule).toHaveBeenCalledWith('google_drive');
        expect(onSyncNow).toHaveBeenCalledWith('google_drive');
        expect(screen.getByText(/last:/)).toBeInTheDocument();
        expect(screen.getByText(/next:/)).toBeInTheDocument();
    });

    it('CloudSyncSection updates export and schedule settings through setters', () => {
        const setScheduleFrequency = vi.fn();
        const setScheduleFormat = vi.fn();
        const setScheduleIncludeVisibility = vi.fn();
        const setCloudExportFormat = vi.fn();
        const setCloudIncludeVisibility = vi.fn();
        render(
            <CloudSyncSection
                connectedProviders={['google_drive']}
                schedules={{}}
                uploading={null}
                syncing={null}
                scheduleFrequency={{ google_drive: 'daily', onedrive: 'daily', dropbox: 'daily' }}
                setScheduleFrequency={setScheduleFrequency}
                scheduleFormat={{ google_drive: 'txt', onedrive: 'txt', dropbox: 'txt' }}
                setScheduleFormat={setScheduleFormat}
                scheduleIncludeVisibility={{ google_drive: false, onedrive: false, dropbox: false }}
                setScheduleIncludeVisibility={setScheduleIncludeVisibility}
                cloudExportFormat="txt"
                setCloudExportFormat={setCloudExportFormat}
                cloudIncludeVisibility={false}
                setCloudIncludeVisibility={setCloudIncludeVisibility}
                onUpload={vi.fn()}
                onSaveSchedule={vi.fn()}
                onRemoveSchedule={vi.fn()}
                onSyncNow={vi.fn()}
                t={mockT}
            />,
        );

        const [exportFormatSelect, frequencySelect, scheduleFormatSelect] = screen.getAllByRole('combobox');
        const [exportVisibilityCheckbox, scheduleVisibilityCheckbox] = screen.getAllByRole('checkbox');

        fireEvent.change(exportFormatSelect!, { target: { value: 'json' } });
        fireEvent.change(frequencySelect!, { target: { value: 'weekly' } });
        fireEvent.change(scheduleFormatSelect!, { target: { value: 'md' } });
        fireEvent.click(exportVisibilityCheckbox!);
        fireEvent.click(scheduleVisibilityCheckbox!);

        expect(setCloudExportFormat).toHaveBeenCalledWith('json');
        expect(setScheduleFrequency).toHaveBeenCalled();
        expect(setScheduleFormat).toHaveBeenCalled();
        expect(setCloudIncludeVisibility).toHaveBeenCalled();
        expect(setScheduleIncludeVisibility).toHaveBeenCalled();
    });
});
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CloudFilesSection from './CloudFilesSection';
import CloudScheduleSection from './CloudScheduleSection';
import { formatDate, formatFileSize } from './cloudSyncFormat';

const t = (key: string, params?: Record<string, string | number>): string => (
    params ? `${key}:${JSON.stringify(params)}` : key
);

function renderSchedule(overrides: Partial<Parameters<typeof CloudScheduleSection>[0]> = {}) {
    const props = {
        t,
        schedule: { enabled: true, lastSyncAt: '2024-01-01T10:00:00Z', nextSyncAt: '2024-01-02T10:00:00Z' },
        frequency: 'daily' as const,
        format: 'txt' as const,
        includeVisibility: false,
        syncing: false,
        onFrequencyChange: vi.fn(),
        onFormatChange: vi.fn(),
        onToggleIncludeVisibility: vi.fn(),
        onSave: vi.fn(),
        onRemove: vi.fn(),
        onSyncNow: vi.fn(),
        ...overrides,
    };
    render(<CloudScheduleSection {...props} />);
    return props;
}

describe('cloudSyncFormat', () => {
    it('formats file sizes in bytes, kilobytes and megabytes', () => {
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
    });

    it('falls back to the raw date when it cannot be formatted', () => {
        const toLocaleDateString = vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(() => {
            throw new RangeError('bad locale');
        });

        expect(formatDate('2024-01-01')).toBe('2024-01-01');
        toLocaleDateString.mockRestore();
    });
});

describe('CloudScheduleSection', () => {
    it('shows the enabled schedule with its last and next sync times', () => {
        renderSchedule();

        expect(screen.getByText('cloudScheduleEnabled')).toBeInTheDocument();
        expect(screen.getByText(/^cloudLastSync:/)).toBeInTheDocument();
        expect(screen.getByText(/^cloudNextSync:/)).toBeInTheDocument();
        expect(screen.getByText('cloudScheduleDisable')).toBeInTheDocument();
    });

    it('hides the status, times and disable button without an enabled schedule', () => {
        renderSchedule({ schedule: { enabled: false, nextSyncAt: '2024-01-02T10:00:00Z' } });

        expect(screen.queryByText('cloudScheduleEnabled')).not.toBeInTheDocument();
        expect(screen.queryByText(/^cloudLastSync:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/^cloudNextSync:/)).not.toBeInTheDocument();
        expect(screen.queryByText('cloudScheduleDisable')).not.toBeInTheDocument();
    });

    it('passes form changes and actions to its handlers', () => {
        const props = renderSchedule();
        const [frequencySelect, formatSelect] = screen.getAllByRole('combobox');

        fireEvent.change(frequencySelect!, { target: { value: 'weekly' } });
        fireEvent.change(formatSelect!, { target: { value: 'json' } });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByText('cloudScheduleEnable'));
        fireEvent.click(screen.getByText('cloudScheduleDisable'));
        fireEvent.click(screen.getByText('cloudSyncNow'));

        expect(props.onFrequencyChange).toHaveBeenCalledWith('weekly');
        expect(props.onFormatChange).toHaveBeenCalledWith('json');
        expect(props.onToggleIncludeVisibility).toHaveBeenCalledTimes(1);
        expect(props.onSave).toHaveBeenCalledTimes(1);
        expect(props.onRemove).toHaveBeenCalledTimes(1);
        expect(props.onSyncNow).toHaveBeenCalledTimes(1);
    });

    it('disables sync now while a sync runs', () => {
        renderSchedule({ syncing: true });

        expect(screen.getByText('cloudSyncing').closest('button')).toBeDisabled();
    });
});

describe('CloudFilesSection', () => {
    const file = { id: 'f1', name: 'export.txt', size: 2048, modifiedAt: '2024-01-01T10:00:00Z' };

    it('shows a loading line while files load', () => {
        render(<CloudFilesSection t={t} providerName="Dropbox" files={[]} loading downloadingFileId={null} onDownload={vi.fn()} />);

        expect(screen.getByText('cloudFilesInCloud:{"provider":"Dropbox"}')).toBeInTheDocument();
        expect(screen.getByText('loading...')).toBeInTheDocument();
    });

    it('downloads a listed file', () => {
        const onDownload = vi.fn();
        render(<CloudFilesSection t={t} providerName="Dropbox" files={[file]} loading={false} downloadingFileId={null} onDownload={onDownload} />);

        expect(screen.getByText(/^2\.0 KB · /)).toBeInTheDocument();
        fireEvent.click(screen.getByText('cloudDownload'));

        expect(onDownload).toHaveBeenCalledWith(file);
    });

    it('disables the button of the file being downloaded', () => {
        render(<CloudFilesSection t={t} providerName="Dropbox" files={[file]} loading={false} downloadingFileId="f1" onDownload={vi.fn()} />);

        expect(screen.getByText('downloading').closest('button')).toBeDisabled();
    });
});

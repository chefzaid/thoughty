import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DangerZoneSection, ExportSection, FormatSection, ImportSection, RouteActions } from './ImportExportPanels';

const mockT = (key: string): string => key;
const sectionRef = { current: document.createElement('section') };
const mockFormatConfig = {
    entrySeparator: '---',
    sameDaySeparator: '***',
    datePrefix: '[',
    dateSuffix: ']',
    dateFormat: 'YYYY-MM-DD',
    tagOpenBracket: '(',
    tagCloseBracket: ')',
    tagSeparator: ',',
};

describe('ImportExportPanels', () => {
    it('RouteActions calls the section handler', () => {
        const onSelectSection = vi.fn();
        render(
            <RouteActions
                activeSection="export"
                onSelectSection={onSelectSection}
                t={mockT}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'import' }));

        expect(onSelectSection).toHaveBeenCalledWith('import');
    });

    it('ExportSection updates format, toggles visibility, and exports', () => {
        const onChangeExportFormat = vi.fn();
        const onToggleIncludeVisibility = vi.fn();
        const onExport = vi.fn();
        render(
            <ExportSection
                activeSection="export"
                sectionRef={sectionRef}
                diaryName="Personal"
                exportFormat="txt"
                includeVisibility={false}
                onChangeExportFormat={onChangeExportFormat}
                onToggleIncludeVisibility={onToggleIncludeVisibility}
                onExport={onExport}
                t={mockT}
            />,
        );

        fireEvent.change(screen.getByDisplayValue('formatTxt'), { target: { value: 'md' } });
        fireEvent.click(screen.getByText('includeVisibilityShort'));
        fireEvent.click(screen.getByText('downloadExport'));

        expect(screen.getByRole('option', { name: 'formatCsv' })).toBeInTheDocument();
        expect(onChangeExportFormat).toHaveBeenCalledWith('md');
        expect(onToggleIncludeVisibility).toHaveBeenCalledTimes(1);
        expect(onExport).toHaveBeenCalledTimes(1);
    });

    it('ImportSection renders preview controls and import actions', () => {
        const onFileSelect = vi.fn();
        const onSetSkipDuplicates = vi.fn();
        const onImport = vi.fn();
        render(
            <ImportSection
                activeSection="import"
                sectionRef={sectionRef}
                diaryName="Personal"
                preview={{ totalCount: 3, duplicateCount: 1 }}
                skipDuplicates={true}
                importing={false}
                onFileSelect={onFileSelect}
                onSetSkipDuplicates={onSetSkipDuplicates}
                onImport={onImport}
                t={mockT}
            />,
        );

        fireEvent.change(document.querySelector('#file-input') as HTMLInputElement);
        fireEvent.click(screen.getByText('skipDuplicates'));
        fireEvent.click(screen.getByText('confirmImport'));

        expect(onFileSelect).toHaveBeenCalled();
        expect(onSetSkipDuplicates).toHaveBeenCalledWith(false);
        expect(onImport).toHaveBeenCalledTimes(1);
    });

    it('FormatSection updates fields and saves', () => {
        const onInputChange = vi.fn();
        const onSave = vi.fn();
        render(
            <FormatSection
                formatConfig={mockFormatConfig}
                onInputChange={onInputChange}
                onSave={onSave}
                t={mockT}
            />,
        );

        fireEvent.change(screen.getByDisplayValue('---'), { target: { value: '===' } });
        fireEvent.change(screen.getByDisplayValue('YYYY-MM-DD'), { target: { value: 'DD/MM/YYYY' } });
        fireEvent.click(screen.getByText('saveFormat'));

        expect(onInputChange).toHaveBeenCalledWith('entrySeparator', '===');
        expect(onInputChange).toHaveBeenCalledWith('dateFormat', 'DD/MM/YYYY');
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('DangerZoneSection renders cancel and delete actions', () => {
        const onCancelDelete = vi.fn();
        const onDeleteAll = vi.fn();
        render(
            <DangerZoneSection
                confirmDeleteAll={true}
                deleting={false}
                deleteAllLabel="confirmDeleteAll"
                diaryName="Personal"
                onCancelDelete={onCancelDelete}
                onDeleteAll={onDeleteAll}
                t={mockT}
            />,
        );

        fireEvent.click(screen.getByText('cancel'));
        fireEvent.click(screen.getByText('confirmDeleteAll'));

        expect(onCancelDelete).toHaveBeenCalledTimes(1);
        expect(onDeleteAll).toHaveBeenCalledTimes(1);
    });
});

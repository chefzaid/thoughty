import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportExport from './ImportExport';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return {
        useAuth: () => ({ authFetch })
    };
});

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
});

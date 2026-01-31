import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportExport from './ImportExport';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args) => globalThis.fetch(...args);
    return {
        useAuth: () => ({ authFetch })
    };
});

const mockT = (key) => key;

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
        globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });

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
        globalThis.fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('saveFormat')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('saveFormat'));

        await waitFor(() => {
            const calls = globalThis.fetch.mock.calls.filter((c) => c[0] === '/api/io/format');
            expect(calls.length).toBeGreaterThan(1);
            expect(calls[1][1]?.method).toBe('POST');
        });
    });

    it('exports entries', async () => {
        const mockBlob = new Blob(['data'], { type: 'text/plain' });
        globalThis.fetch
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
            const exportCall = globalThis.fetch.mock.calls.find((c) => c[0].includes('/api/io/export'));
            expect(exportCall).toBeTruthy();
        });
    });

    it('previews and imports file content', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ totalCount: 3, duplicateCount: 1 }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ importedCount: 2, skippedCount: 1 }) });

        const originalFileReader = globalThis.FileReader;
        globalThis.FileReader = class MockFileReader {
            readAsText() {
                setTimeout(() => {
                    this.onload({ target: { result: 'file content' } });
                }, 0);
            }
        };

        render(<ImportExport theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('chooseFile')).toBeInTheDocument();
        });

        const input = document.querySelector('#file-input');
        const file = new File(['data'], 'test.txt', { type: 'text/plain' });
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText('previewSummary')).toBeInTheDocument();
            expect(screen.getByText('skipDuplicates')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('confirmImport'));

        await waitFor(() => {
            const importCall = globalThis.fetch.mock.calls.find((c) => c[0] === '/api/io/import');
            expect(importCall).toBeTruthy();
        });

        globalThis.FileReader = originalFileReader;
    });

    it('handles delete all confirmation and delete', async () => {
        globalThis.fetch
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
            const deleteCall = globalThis.fetch.mock.calls.find((c) => c[0].includes('/api/entries/all'));
            expect(deleteCall?.[1]?.method).toBe('DELETE');
        });
    });
});

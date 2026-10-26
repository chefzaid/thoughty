import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getTranslation, type Language } from '../../utils/translations';
import ImportExport from './ImportExport';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => {
        const [url, options] = args;
        const requestUrl = url instanceof Request ? url.url : url.toString();
        if (requestUrl.startsWith('/api/books/versions?') && options?.method !== 'POST') {
            return Promise.resolve({ ok: true, json: async () => [] } as Response);
        }
        return globalThis.fetch(...args);
    };
    return { useAuth: () => ({ authFetch }) };
});

vi.mock('../../hooks/useAppState', () => ({
    useApiServices: () => ({
        cloudSyncService: {
            getStatus: vi.fn().mockResolvedValue({}),
            getSchedules: vi.fn().mockResolvedValue([]),
        },
    }),
}));

const formatConfig = {
    entrySeparator: '---',
    sameDaySeparator: '***',
    datePrefix: '---',
    dateSuffix: '--',
    dateFormat: 'YYYY-MM-DD',
    tagOpenBracket: '[',
    tagCloseBracket: ']',
    tagSeparator: ',',
};

async function importFile(language: Language, importedCount: number, skippedCount: number) {
    (globalThis.fetch as Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => formatConfig })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ totalCount: importedCount + skippedCount, duplicateCount: skippedCount }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ importedCount, skippedCount }) });
    const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
    render(<ImportExport theme="dark" language={language} t={t} />);

    await screen.findByText(t('chooseFile'));
    const input = document.querySelector('#file-input') as HTMLInputElement;
    const file = { name: 'journal.txt', type: 'text/plain', size: 12, text: async () => 'file content' } as unknown as File;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    fireEvent.click(await screen.findByText(t('confirmImport')));
}

describe('ImportExport import message', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['en', 1, 1, 'Successfully imported 1 entry (1 duplicate skipped)'],
        ['en', 2, 0, 'Successfully imported 2 entries (0 duplicates skipped)'],
        ['fr', 1, 1, '1 entrée importée avec succès (1 doublon ignoré)'],
        ['fr', 2, 0, '2 entrées importées avec succès (0 doublon ignoré)'],
    ] as const)('counts imported and skipped entries in %s (%i, %i)', async (language, imported, skipped, expected) => {
        await importFile(language, imported, skipped);

        expect(await screen.findByText(expected)).toBeInTheDocument();
    });
});

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

/**
 * Fake timers that also follow the wall clock, so Testing Library's polling keeps running; React's
 * scheduler (`setImmediate`) stays real.
 */
function installFakeTimers() {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
}

/** Node's `setImmediate`, which the fake timers leave real and React's scheduler runs effects on. */
const { setImmediate: realSetImmediate } = globalThis as unknown as { setImmediate: (callback: () => void) => void };

/** Waits until a message is on screen and its effects (the countdown) have run. */
async function settle(text: string) {
    await screen.findByText(text);
    await new Promise<void>((resolve) => realSetImmediate(resolve));
}

function chooseFile() {
    const input = document.querySelector('#file-input') as HTMLInputElement;
    const file = { name: 'journal.txt', type: 'text/plain', size: 12, text: async () => 'file content' } as unknown as File;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
}

async function importFile(language: Language, importedCount: number, skippedCount: number) {
    (globalThis.fetch as Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => formatConfig })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ totalCount: importedCount + skippedCount, duplicateCount: skippedCount }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ importedCount, skippedCount }) });
    const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
    render(<ImportExport theme="dark" language={language} t={t} />);

    await screen.findByText(t('chooseFile'));
    chooseFile();
    fireEvent.click(await screen.findByText(t('confirmImport')));
}

describe('ImportExport import message', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
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

    it('hides an error message four seconds after it appears', async () => {
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => formatConfig })
            .mockResolvedValueOnce({ ok: false, json: async () => ({}) });
        const t = (key: string) => getTranslation('en', key);
        render(<ImportExport theme="dark" language="en" t={t} />);
        installFakeTimers();
        await screen.findByText(t('chooseFile'));
        chooseFile();
        await settle(t('previewError'));

        // The fake clock also moves with the wall clock, so the checks leave a second's margin.
        act(() => vi.advanceTimersByTime(3000));
        expect(screen.getByText(t('previewError'))).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1000));
        expect(screen.queryByText(t('previewError'))).not.toBeInTheDocument();
    });

    it('keeps the import summary until the next message', async () => {
        const summary = 'Successfully imported 2 entries (0 duplicates skipped)';
        installFakeTimers();
        await importFile('en', 2, 0);
        await settle(summary);

        act(() => vi.advanceTimersByTime(10_000));
        expect(screen.getByText(summary)).toBeInTheDocument();
    });
});

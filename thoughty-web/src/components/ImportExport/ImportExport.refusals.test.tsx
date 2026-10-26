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
            getStatus: vi.fn().mockResolvedValue({ data: {}, error: null }),
            getSchedules: vi.fn().mockResolvedValue({ data: {}, error: null }),
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

/** A refused request with the API's JSON error body. */
function refusal(status: number, body: Record<string, unknown>) {
    return { ok: false, status, json: async () => ({ statusCode: status, ...body }) };
}

const diaryGone = refusal(404, { message: 'Diary not found', code: 'DIARY_NOT_FOUND' });
const invalid = refusal(400, { message: ['dateFormat must be a string'], code: 'VALIDATION_FAILED' });

/** Renders the page in a language once its format settings have loaded. */
async function renderPage(language: Language, ...responses: unknown[]) {
    const fetchMock = globalThis.fetch as Mock;
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => formatConfig });
    responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
    const t = (key: string) => getTranslation(language, key);
    render(<ImportExport theme="dark" language={language} t={t} diaryId={7} />);
    await screen.findByText(t('saveFormat'));
    return t;
}

describe('ImportExport refusals', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['en', 'This diary could not be found.'],
        ['fr', 'Ce journal est introuvable.'],
    ] as const)('shows the reason a refused export gives, in %s', async (language, expected) => {
        const t = await renderPage(language, diaryGone);
        fireEvent.click(screen.getByText(t('downloadExport')));

        expect(await screen.findByText(expected)).toBeInTheDocument();
        expect(screen.queryByText(t('exportSuccess'))).not.toBeInTheDocument();
    });

    it.each([
        ['en', 'Some of the details sent are missing or invalid.'],
        ['fr', 'Certaines informations envoyées sont manquantes ou invalides.'],
    ] as const)('shows the reason a refused format save gives, in %s', async (language, expected) => {
        const t = await renderPage(language, invalid);
        fireEvent.click(screen.getByText(t('saveFormat')));

        expect(await screen.findByText(expected)).toBeInTheDocument();
        expect(screen.queryByText(t('formatSaved'))).not.toBeInTheDocument();
    });

    it.each([
        ['en', 'This diary could not be found.'],
        ['fr', 'Ce journal est introuvable.'],
    ] as const)('shows the reason a refused delete all gives, in %s', async (language, expected) => {
        const t = await renderPage(language, diaryGone);
        fireEvent.click(screen.getByText(t('deleteAllEntries')));
        fireEvent.click(screen.getByText(t('confirmDeleteAll')));

        expect(await screen.findByText(expected)).toBeInTheDocument();
        expect(screen.queryByText(t('deleteAllError'))).not.toBeInTheDocument();
    });

    it('falls back to each generic message when a refusal gives no reason', async () => {
        const t = await renderPage('fr', refusal(503, {}), refusal(503, {}), refusal(503, {}));

        fireEvent.click(screen.getByText(t('downloadExport')));
        expect(await screen.findByText(t('exportError'))).toBeInTheDocument();

        fireEvent.click(screen.getByText(t('saveFormat')));
        expect(await screen.findByText(t('formatSaveError'))).toBeInTheDocument();

        fireEvent.click(screen.getByText(t('deleteAllEntries')));
        fireEvent.click(screen.getByText(t('confirmDeleteAll')));
        expect(await screen.findByText(t('deleteAllError'))).toBeInTheDocument();
    });
});

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getTranslation } from '../../utils/translations';
import ImportExport from './ImportExport';

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ authFetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }),
}));

// The real cloud service, so the API's error body goes all the way to the screen.
vi.mock('../../hooks/useAppState', async () => {
    const { createCloudSyncService } = await import('../../services/api/cloudSyncService');
    const cloudSyncService = createCloudSyncService((...args) => globalThis.fetch(...args));
    return { useApiServices: () => ({ cloudSyncService }) };
});

const t = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
const EXPIRED = 'La connexion à ce service cloud a expiré. Veuillez le reconnecter.';

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;
const expired = () => json({
    statusCode: 400,
    message: 'google drive connection expired. Please reconnect.',
    error: 'Bad Request',
    code: 'CLOUD_CONNECTION_EXPIRED',
}, 400);
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
const cloudFile = { id: 'file-1', name: 'journal.txt', size: 2048, modifiedAt: '2024-01-01T12:00:00.000Z' };

/** Answers the Import/Export page's requests, refusing the cloud paths given (by default with the API's coded reason). */
function answerRequests(refused: readonly string[], refusal: () => Response = expired) {
    (globalThis.fetch as Mock).mockImplementation(async (input: string) => {
        const [path = input] = input.split('?');
        if (refused.includes(path)) return refusal();
        switch (path) {
            case '/api/io/format': return json(formatConfig);
            case '/api/cloud-sync/status': return json({ google_drive: { connected: true } });
            case '/api/cloud-sync/schedules': return json({ google_drive: { enabled: true, frequency: 'daily', format: 'txt' } });
            case '/api/cloud-sync/files': return json([cloudFile]);
            case '/api/books/versions': return json([]);
            default: return json({});
        }
    });
}

async function renderPage() {
    render(<ImportExport theme="dark" language="fr" t={t} />);
    await screen.findByText(t('cloudUpload'));
}

describe('ImportExport cloud errors', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['upload', '/api/cloud-sync/upload', 'cloudUpload'],
        ['schedule save', '/api/cloud-sync/schedule', 'cloudScheduleEnable'],
        ['schedule removal', '/api/cloud-sync/schedule', 'cloudScheduleDisable'],
        ['sync now', '/api/cloud-sync/sync', 'cloudSyncNow'],
    ])('shows the reason a refused %s gives, in French', async (_action, path, button) => {
        answerRequests([path]);
        await renderPage();

        fireEvent.click(screen.getByText(t(button)));

        expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    });

    it('shows the reason a refused cloud file list gives, instead of an empty folder', async () => {
        answerRequests(['/api/cloud-sync/files']);
        await renderPage();

        fireEvent.click(screen.getAllByRole('button', { name: /Google Drive/ })[0] as HTMLElement);

        expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
        expect(screen.queryByText(cloudFile.name)).not.toBeInTheDocument();
    });

    it('shows the reason a refused cloud import gives, and previews nothing', async () => {
        answerRequests(['/api/cloud-sync/download']);
        await renderPage();

        fireEvent.click(screen.getAllByRole('button', { name: /Google Drive/ })[0] as HTMLElement);
        await screen.findByText(cloudFile.name);
        fireEvent.click(screen.getAllByRole('button', { name: t('import') }).at(-1) as HTMLElement);

        expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
        expect(screen.queryByText(t('previewSummary'))).not.toBeInTheDocument();
    });

    it('falls back to its own message when the API gives no reason', async () => {
        answerRequests(['/api/cloud-sync/upload'], () => json({ statusCode: 503 }, 503));
        await renderPage();

        fireEvent.click(screen.getByText(t('cloudUpload')));

        expect(await screen.findByText(t('cloudUploadError'))).toBeInTheDocument();
    });
});

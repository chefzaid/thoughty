import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ImportExport from './ImportExport';
import { withFeatureFlags } from '../../test/featureFlags';
import { getTranslation } from '../../utils/translations';

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ authFetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }),
}));

const mockCloudSyncService = {
    getStatus: vi.fn(),
    getSchedules: vi.fn(),
};

vi.mock('../../hooks/useAppState', () => ({
    useApiServices: () => ({ cloudSyncService: mockCloudSyncService }),
}));

const FORMAT_CONFIG = {
    entrySeparator: '-'.repeat(80),
    sameDaySeparator: '*'.repeat(80),
    datePrefix: '---',
    dateSuffix: '--',
    dateFormat: 'YYYY-MM-DD',
    tagOpenBracket: '[',
    tagCloseBracket: ']',
    tagSeparator: ',',
};

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

describe('ImportExport with the book converter and cloud sync switched off', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => FORMAT_CONFIG });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('says so in their sections, offers no book route, and asks nothing of the cloud API', async () => {
        render(
            <ImportExport theme="dark" t={t} diaryId={null} diaryName="Personal" initialSection="book" />,
            { wrapper: withFeatureFlags({ bookConverter: false, cloudSync: false }) },
        );

        const bookSection = (await screen.findByRole('heading', { level: 2, name: t('book') })).closest('section') as HTMLElement;
        expect(within(bookSection).getByRole('note')).toHaveTextContent('The book converter is turned off for now');
        const cloudSection = screen.getByRole('heading', { level: 2, name: t('cloudSync') }).closest('section') as HTMLElement;
        expect(within(cloudSection).getByRole('note')).toHaveTextContent('Cloud sync is turned off for now');
        const routes = screen.getByRole('navigation', { name: t('importExport') });
        expect(within(routes).queryByRole('button', { name: t('book') })).not.toBeInTheDocument();
        expect(within(routes).getByRole('button', { name: t('export') })).toBeInTheDocument();
        expect(mockCloudSyncService.getStatus).not.toHaveBeenCalled();
        expect(mockCloudSyncService.getSchedules).not.toHaveBeenCalled();
        expect((globalThis.fetch as Mock).mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/books'))).toEqual([]);
    });
});

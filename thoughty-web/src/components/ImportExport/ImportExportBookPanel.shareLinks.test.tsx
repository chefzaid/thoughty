import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation } from '../../utils/translations';
import { ImportExportBookPanel } from './ImportExportBookPanel';

const VERSION = {
    id: 9, versionNumber: 3, title: 'Summer', format: 'pdf', filename: 'summer.pdf', chapterCount: 1, entryCount: 2,
    addedEntryCount: 0, addedChapterTitles: [], source: { kind: 'journal', diaryId: 1 }, createdAt: '2026-10-27T10:00:00.000Z',
};

describe('ImportExportBookPanel private share links', () => {
    it('opens the share links of a saved version with the session’s requests', async () => {
        const user = userEvent.setup();
        const authFetch = vi.fn(async (url: string) => ({
            ok: true,
            json: async () => (url.startsWith('/api/share-links') ? { links: [], limit: 100, activeCount: 0 } : url.startsWith('/api/books/versions') ? [VERSION] : []),
        }) as unknown as Response);
        render(
            <ImportExportBookPanel
                activeSection="book"
                authFetch={authFetch}
                connectedProviders={[]}
                diaryId={1}
                diaryName="Personal"
                isLight
                language="en"
                sectionRef={{ current: null }}
                showMessage={vi.fn()}
                t={(key, params) => getTranslation('en', key, params)}
            />,
        );

        await user.click(await screen.findByRole('button', { name: 'Share version 3 privately' }));

        const dialog = screen.getByRole('dialog', { name: 'Share privately' });
        expect(dialog).toHaveTextContent('Version 3 · Summer');
        expect(await screen.findByText('No active links.')).toBeInTheDocument();
        expect(authFetch).toHaveBeenCalledWith('/api/share-links?kind=bookVersion&targetId=9');
        await user.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';
import { getTranslation } from '../../utils/translations';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const service = vi.hoisted(() => ({
    list: vi.fn().mockResolvedValue({ data: { links: [], limit: 100, activeCount: 0 }, error: null }),
    create: vi.fn(),
    revoke: vi.fn(),
}));

vi.mock('../../hooks/useAuthenticatedService', () => ({
    useAuthenticatedService: () => service,
}));

describe('EntryViewMode private share links', () => {
    it('opens the entry’s share links from More actions, and gives focus back when closed', async () => {
        const user = userEvent.setup();
        const entry = { ...mockEntries[0], title: 'A walk by the sea' };
        render(<EntryViewMode {...createEntryViewModeProps({ entry, t })} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Share privately…' }));

        const dialog = await screen.findByRole('dialog', { name: 'Share privately' });
        expect(dialog).toHaveTextContent('A walk by the sea');
        expect(service.list).toHaveBeenCalledWith({ kind: 'entry', id: entry.id });
        await user.click(screen.getAllByRole('button', { name: 'Close' })[0]!);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus());
    });

    it('names an entry without a title by its day', async () => {
        const user = userEvent.setup();
        render(<EntryViewMode {...createEntryViewModeProps({ entry: { ...mockEntries[0], title: null, date: '2026-10-27' }, t })} />);

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Share privately…' }));

        expect(await screen.findByRole('dialog')).toHaveTextContent('October 27, 2026');
    });
});

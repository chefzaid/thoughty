import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

vi.mock('../../hooks/useAuthenticatedService', () => ({
    useAuthenticatedService: () => ({ set: vi.fn(), clear: vi.fn() }),
}));

function renderCard(entry: (typeof mockEntries)[number]) {
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <EntryViewMode {...createEntryViewModeProps({ entry, t })} />
        </QueryClientProvider>,
    );
}

describe('EntryViewMode reread reminders', () => {
    it('asks on which day to reread the entry from More actions, and gives focus back when closed', async () => {
        const user = userEvent.setup();
        renderCard({ ...mockEntries[0]!, title: 'A walk by the sea' });

        expect(screen.queryByText(/^Reread on/)).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Remind me to reread…' }));

        const dialog = await screen.findByRole('dialog', { name: 'Remind me to reread' });
        expect(dialog).toHaveTextContent('A walk by the sea');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus());
    });

    it('shows the day the writer asked to reread it on, with a way to remove it', () => {
        renderCard({ ...mockEntries[0]!, reread_on: '2026-11-07' });

        expect(screen.getByText('Reread on November 7, 2026')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove the reminder to reread on November 7, 2026' })).toBeInTheDocument();
    });
});

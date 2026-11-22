import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';
import { getTranslation } from '../../utils/translations';
import { createTestQueryClient } from '../../test/queryClient';
import { MentionPeopleContext } from '../People/PeopleContext';
import { peopleByHandle } from '../../utils/mentions';
import type { Entry } from '../../types';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const service = vi.hoisted(() => ({
    list: vi.fn().mockResolvedValue({ data: { links: [], limit: 100, activeCount: 0 }, error: null }),
    create: vi.fn().mockResolvedValue({ data: { id: 9, token: 'abc' }, error: null }),
    revoke: vi.fn(),
    updateEntry: vi.fn().mockResolvedValue(true),
}));

const marie = { id: 1, name: 'Marie Dupont', handles: ['marie'], date: null, reachOutDays: null, lastContactOn: null, notes: null, groups: [], entryCount: 1, lastMentionedOn: null, createdAt: '', updatedAt: '' };

function renderCard(entry: Entry) {
    render(
        <MemoryRouter>
            <QueryClientProvider client={createTestQueryClient()}>
                <MentionPeopleContext.Provider value={{ people: [marie], byHandle: peopleByHandle([marie]) }}>
                    <EntryViewMode {...createEntryViewModeProps({ entry, t })} />
                </MentionPeopleContext.Provider>
            </QueryClientProvider>
        </MemoryRouter>,
    );
}

async function openShareLinks(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Share privately…' }));
    return screen.findByRole('dialog', { name: 'Share privately' });
}

vi.mock('../../hooks/useAuthenticatedService', () => ({
    useAuthenticatedService: () => service,
}));

describe('EntryViewMode private share links', () => {
    it('opens the entry’s share links from More actions, and gives focus back when closed', async () => {
        const user = userEvent.setup();
        const entry = { ...mockEntries[0], title: 'A walk by the sea' };
        renderCard(entry);

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
        renderCard({ ...mockEntries[0]!, title: null, date: '2026-10-27' });

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Share privately…' }));

        expect(await screen.findByRole('dialog')).toHaveTextContent('October 27, 2026');
    });

    it('makes a link at once when the entry names no one', async () => {
        const user = userEvent.setup();
        service.create.mockClear();
        renderCard({ ...mockEntries[0]!, content: 'A quiet walk', title: null });

        const dialog = await openShareLinks(user);
        await user.click(within(dialog).getByRole('button', { name: 'Create link' }));

        await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('dialog', { name: 'People in what you share' })).not.toBeInTheDocument();
    });

    it('lists the people the entry names before making a link, and makes it on Share anyway', async () => {
        const user = userEvent.setup();
        service.create.mockClear();
        renderCard({ ...mockEntries[0]!, content: 'Lunch with @marie and Marie Dupont', title: null });

        const dialog = await openShareLinks(user);
        await user.click(within(dialog).getByRole('button', { name: 'Create link' }));
        const check = await screen.findByRole('dialog', { name: 'People in what you share' });
        expect(check).toHaveTextContent('Marie Dupont2 mentions');
        expect(service.create).not.toHaveBeenCalled();

        await user.click(within(check).getByRole('button', { name: 'Share anyway' }));
        await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
    });

    it('saves the new words on Replace without making a link, and says to read the entry again', async () => {
        const user = userEvent.setup();
        service.create.mockClear();
        const entry = { ...mockEntries[0]!, content: 'Lunch with @marie', title: 'Marie Dupont came', visibility: 'private' as const };
        renderCard(entry);

        const dialog = await openShareLinks(user);
        await user.click(within(dialog).getByRole('button', { name: 'Create link' }));
        const check = await screen.findByRole('dialog', { name: 'People in what you share' });
        await user.selectOptions(within(check).getByRole('combobox', { name: 'Replace Marie Dupont with' }), 'a friend');
        await user.click(within(check).getByRole('button', { name: 'Replace' }));

        await waitFor(() => expect(service.updateEntry).toHaveBeenCalledWith(entry.id, expect.objectContaining({
            text: 'Lunch with a friend',
            title: 'A friend came',
            visibility: 'private',
        })));
        expect(await within(dialog).findByText('Names replaced in 1 entry. Read it again before sharing it.')).toHaveAttribute('role', 'status');
        expect(service.create).not.toHaveBeenCalled();
    });

    it('makes no link when the check is cancelled', async () => {
        const user = userEvent.setup();
        service.create.mockClear();
        renderCard({ ...mockEntries[0]!, content: 'Lunch with @marie', title: null });

        const dialog = await openShareLinks(user);
        await user.click(within(dialog).getByRole('button', { name: 'Create link' }));
        const check = await screen.findByRole('dialog', { name: 'People in what you share' });
        await user.click(within(check).getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog', { name: 'People in what you share' })).not.toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Create link' })).toBeEnabled();
        expect(service.create).not.toHaveBeenCalled();
    });
});

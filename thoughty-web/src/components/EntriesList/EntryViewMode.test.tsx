import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryViewMode from './EntryViewMode';
import {
    createEntryViewModeProps,
    getTestEntryPermalink,
    mockEntries,
    mockRevisions,
    mockSourceEntry,
} from './EntriesList.test-utils';

const renderEntryViewMode = (
    overrides: Partial<Parameters<typeof createEntryViewModeProps>[0]> = {},
) => render(<EntryViewMode {...createEntryViewModeProps(overrides)} />);

const clickToolbarAction = async (
    user: ReturnType<typeof userEvent.setup>,
    title: string,
) => {
    await user.click(screen.getByTitle(title));
};

const PRIMARY_TOOLBAR_ACTIONS = [
    'Private - only you can see',
    'Favorite',
    'Edit',
] as const;

describe('EntryViewMode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders entry content, tags, index, and diary label', () => {
        renderEntryViewMode();

        expect(screen.getByText('First entry')).toBeInTheDocument();
        expect(screen.getByText('#work')).toBeInTheDocument();
        expect(screen.getByText('#important')).toBeInTheDocument();
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('renders archived status and toggles archive', async () => {
        const onToggleArchived = vi.fn();
        const user = userEvent.setup();
        renderEntryViewMode({
            entry: { ...mockEntries[0], is_archived: true },
            onToggleArchived,
        });

        expect(screen.getByText('Archived')).toBeInTheDocument();
        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('Unarchive'));

        expect(onToggleArchived).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    it('calls visibility, favorite, and edit handlers from the primary toolbar', async () => {
        const onToggleVisibility = vi.fn();
        const onToggleFavorite = vi.fn();
        const onEdit = vi.fn();
        const user = userEvent.setup();
        renderEntryViewMode({
            onToggleVisibility,
            onToggleFavorite,
            onEdit,
        });

        for (const actionTitle of PRIMARY_TOOLBAR_ACTIONS) {
            await clickToolbarAction(user, actionTitle);
        }

        expect(onToggleVisibility).toHaveBeenCalledWith(mockEntries[0]);
        expect(onToggleFavorite).toHaveBeenCalledWith(mockEntries[0]);
        expect(onEdit).toHaveBeenCalledWith(mockEntries[0]);
    });

    it('renders secondary actions in the more actions menu', async () => {
        const onToggleArchived = vi.fn();
        const onDelete = vi.fn();
        const onDiscuss = vi.fn();
        const onShareEntry = vi.fn().mockResolvedValue(true);
        const user = userEvent.setup();
        renderEntryViewMode({ onToggleArchived, onDelete, onDiscuss, onShareEntry });

        expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Discuss entry')).not.toBeInTheDocument();

        await user.click(screen.getByLabelText('More actions'));

        expect(screen.getByTitle('Open entry permalink')).toHaveAttribute('href', getTestEntryPermalink(mockEntries[0].id));
        expect(screen.getByTitle('Share entry')).toBeInTheDocument();

        await user.click(screen.getByTitle('Discuss entry'));
        expect(onDiscuss).toHaveBeenCalledWith(mockEntries[0]);

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('Archive'));
        expect(onToggleArchived).toHaveBeenCalledWith(mockEntries[0]);

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('Delete'));
        expect(onDelete).toHaveBeenCalledWith(1);

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('Share entry'));
        expect(onShareEntry).toHaveBeenCalledWith(mockEntries[0]);
    });

    it('renders permalink inside the more actions menu and shares the entry', async () => {
        const onShareEntry = vi.fn().mockResolvedValue(true);
        const user = userEvent.setup();
        renderEntryViewMode({ onShareEntry });

        await user.click(screen.getByLabelText('More actions'));

        expect(screen.getByLabelText('Open entry permalink')).toHaveAttribute('href', getTestEntryPermalink(mockEntries[0].id));
        await user.click(screen.getByTitle('Share entry'));

        expect(onShareEntry).toHaveBeenCalledWith(mockEntries[0]);
    });

    it('shows the back-to-source action for active targets', async () => {
        const onBackToSource = vi.fn();
        const user = userEvent.setup();
        renderEntryViewMode({
            activeTargetId: 1,
            sourceEntry: mockSourceEntry,
            onBackToSource,
        });

        await user.click(screen.getByTitle('Back to source'));

        expect(onBackToSource).toHaveBeenCalledTimes(1);
        expect(screen.getByText('(2024-01-10--2)')).toBeInTheDocument();
    });

    it('loads and renders history revisions on demand', async () => {
        const onFetchHistory = vi.fn().mockResolvedValue(mockRevisions);
        const user = userEvent.setup();
        renderEntryViewMode({ onFetchHistory });

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('View history'));

        expect(onFetchHistory).toHaveBeenCalledWith(1);
        expect(await screen.findByText('Older revision')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
    });
});

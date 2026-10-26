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
import { getTranslation } from '../../utils/translations';

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
    'Pin entry',
    'Discuss entry',
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
        expect(screen.getByText('2 words')).toBeInTheDocument();
        expect(screen.getByText('1 min read')).toBeInTheDocument();
    });

    it('ticks a task list item of a Markdown entry with the entry and its line', async () => {
        const user = userEvent.setup();
        const onToggleTask = vi.fn();
        const entry = { ...mockEntries[0], format: 'markdown' as const, content: 'Errands\n\n- [ ] Call the bank' };
        renderEntryViewMode({ entry, onToggleTask });

        await user.click(await screen.findByRole('checkbox', { name: 'Call the bank' }));

        expect(onToggleTask).toHaveBeenCalledWith(entry, 2, true);
    });

    it('shows task boxes that cannot change when the journal cannot tick them', async () => {
        renderEntryViewMode({ entry: { ...mockEntries[0], format: 'markdown', content: '- [x] Done' } });

        expect(await screen.findByRole('checkbox', { name: 'Done' })).toBeDisabled();
    });

    it('shows the title as a heading with its search matches marked, and the time next to the date', () => {
        renderEntryViewMode({
            entry: { ...mockEntries[0], title: 'Harbour at dawn', time_of_day: '18:45', search_matches: ['harbour'] },
            searchTerm: 'harbour',
        });

        const heading = screen.getByRole('heading', { name: 'Harbour at dawn' });
        expect(heading.querySelector('mark')).toHaveTextContent('Harbour');
        const time = screen.getByTitle('entryTimeOrderHint');
        expect(time).toHaveAttribute('dateTime', '18:45');
        expect(time).toHaveTextContent(/6:45\sPM/);
    });

    it('shows the recorded mood by its label, with the emoji hidden from screen readers, and the feelings', () => {
        renderEntryViewMode({ entry: { ...mockEntries[0], mood: 4, feelings: ['calm', 'nostalgic'] } });

        const badge = screen.getByText('Good').closest('[data-mood]');
        expect(badge).toHaveAttribute('data-mood', '4');
        expect(badge).toHaveTextContent('Mood: 🙂Good· , Feelings: calm, nostalgic');
        expect(screen.getByText('🙂')).toHaveAttribute('aria-hidden', 'true');
    });

    it('shows feelings recorded without a mood, and no badge when neither is recorded', () => {
        const { unmount } = renderEntryViewMode({ entry: { ...mockEntries[0], mood: null, feelings: ['tired'] } });
        expect(screen.getByText('tired')).toBeInTheDocument();
        unmount();

        renderEntryViewMode({ entry: { ...mockEntries[0], mood: null, feelings: [] } });
        expect(screen.queryByText('Mood:', { exact: false })).not.toBeInTheDocument();
    });

    it('shows the mood an earlier version had in the history', async () => {
        const onFetchHistory = vi.fn().mockResolvedValue([{ ...mockRevisions[0], mood: 2, feelings: ['tired'] }]);
        const user = userEvent.setup();
        renderEntryViewMode({ onFetchHistory });

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('View history'));

        expect(await screen.findByText('Mood: Low · tired')).toBeInTheDocument();
    });

    it('explains the stable link number and shows no title or time when the entry has none', () => {
        renderEntryViewMode({ entry: { ...mockEntries[1], title: null, time_of_day: null } });

        expect(screen.getByText('#2')).toHaveAttribute('title', 'entryLinkNumberHint');
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        expect(screen.queryByTitle('entryTimeOrderHint')).not.toBeInTheDocument();
    });

    it('applies the saved font color only to the entry reading surface', () => {
        renderEntryViewMode({
            config: { theme: 'dark', fontColor: '#123456' },
        });

        expect(screen.getByText('First entry')).toHaveStyle({
            color: 'rgb(18, 52, 86)',
        });
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

    it('calls visibility, favorite, pin, discuss, and edit handlers from the primary toolbar', async () => {
        const onToggleVisibility = vi.fn();
        const onToggleFavorite = vi.fn();
        const onTogglePinned = vi.fn();
        const onDiscuss = vi.fn();
        const onEdit = vi.fn();
        const user = userEvent.setup();
        renderEntryViewMode({
            onToggleVisibility,
            onToggleFavorite,
            onTogglePinned,
            onDiscuss,
            onEdit,
        });

        for (const actionTitle of PRIMARY_TOOLBAR_ACTIONS) {
            await clickToolbarAction(user, actionTitle);
        }

        expect(onToggleVisibility).toHaveBeenCalledWith(mockEntries[0]);
        expect(onToggleFavorite).toHaveBeenCalledWith(mockEntries[0]);
        expect(onTogglePinned).toHaveBeenCalledWith(mockEntries[0]);
        expect(onDiscuss).toHaveBeenCalledWith(mockEntries[0]);
        expect(onEdit).toHaveBeenCalledWith(mockEntries[0]);
    });

    it('renders pinned state and unpins from the toolbar', async () => {
        const onTogglePinned = vi.fn();
        const user = userEvent.setup();
        renderEntryViewMode({
            entry: { ...mockEntries[0], is_pinned: true },
            onTogglePinned,
        });

        expect(screen.getByText(/Pinned/)).toBeInTheDocument();
        expect(screen.getByText(/2024-01-15/)).toBeInTheDocument();

        await user.click(screen.getByTitle('Unpin entry'));

        expect(onTogglePinned).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    it('renders backlinks and navigates to the referring entry', async () => {
        const onFetchBacklinks = vi.fn().mockResolvedValue([
            {
                id: 44,
                date: '2024-01-10',
                index: 2,
                content: 'This links back to [[2024-01-15]].',
                tags: ['notes'],
                format: 'plain',
            },
        ]);
        const onNavigateToEntry = vi.fn();
        const user = userEvent.setup();
        renderEntryViewMode({ onFetchBacklinks, onNavigateToEntry });

        expect(await screen.findByText('Backlinks')).toBeInTheDocument();
        expect(await screen.findByText('This links back to [[2024-01-15]].')).toBeInTheDocument();

        await user.click(screen.getByText('This links back to [[2024-01-15]].'));

        expect(onFetchBacklinks).toHaveBeenCalledWith(1);
        expect(onNavigateToEntry).toHaveBeenCalledWith('2024-01-10', 2, {
            id: 1,
            date: '2024-01-15',
            index: 1,
        });
    });

    it.each([
        ['en', 1, '1 link'],
        ['en', 2, '2 links'],
        ['en', 3, '3 links'],
        ['fr', 1, '1 lien'],
        ['fr', 2, '2 liens'],
        ['fr', 3, '3 liens'],
    ])('counts backlinks in the singular or plural in %s (%i)', async (lang, count, label) => {
        const onFetchBacklinks = vi.fn().mockResolvedValue(
            Array.from({ length: count }, (_, i) => ({
                id: 40 + i,
                date: '2024-01-10',
                index: i + 1,
                content: `Backlink ${i + 1} to [[2024-01-15]].`,
                tags: [],
                format: 'plain',
            })),
        );
        renderEntryViewMode({
            onFetchBacklinks,
            t: (key, params) => getTranslation(lang, key, params),
        });

        expect(await screen.findByText(label)).toBeInTheDocument();
    });

    it.each([
        ['en', 'Rain', '1 word'],
        ['en', 'Rain again', '2 words'],
        ['en', 'Rain all day', '3 words'],
        ['fr', 'Pluie', '1 mot'],
        ['fr', 'Pluie encore', '2 mots'],
        ['fr', 'Pluie toute journée', '3 mots'],
    ])('counts words in the singular or plural in %s (%s)', (lang, content, label) => {
        renderEntryViewMode({
            entry: { ...mockEntries[0], content },
            t: (key, params) => getTranslation(lang, key, params),
        });

        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('renders secondary actions in the more actions menu', async () => {
        const onToggleArchived = vi.fn();
        const onDelete = vi.fn();
        const onDiscuss = vi.fn();
        const onShareEntry = vi.fn().mockResolvedValue(true);
        const user = userEvent.setup();
        renderEntryViewMode({ onToggleArchived, onDelete, onDiscuss, onShareEntry });

        expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
        expect(screen.getByTitle('Discuss entry')).toBeInTheDocument();
        expect(screen.getByLabelText('More actions')).toHaveAttribute('aria-expanded', 'false');

        await user.click(screen.getByLabelText('More actions'));
        expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute('aria-expanded', 'true');

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

    it('opens the rephrase menu and calls the selected mode', async () => {
        const onRephrase = vi.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();
        renderEntryViewMode({ onRephrase });

        await user.click(screen.getByTitle('Rephrase entry'));
        await user.click(screen.getByTitle('Slight style improvements'));

        expect(onRephrase).toHaveBeenCalledWith(mockEntries[0], 'polish');
    });

    it('opens the guided summary dialog from the secondary actions menu', async () => {
        const onSummarize = vi.fn().mockResolvedValue('Short summary');
        const user = userEvent.setup();
        renderEntryViewMode({ onSummarize });

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('Summarize entry'));

        expect(screen.getByRole('dialog', { name: 'Entry summary' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Generate summary' }));

        expect(await screen.findByText('Short summary')).toBeInTheDocument();
        expect(onSummarize).toHaveBeenCalledWith(1, {
            includeDetails: undefined,
            excludeDetails: undefined,
        });
    });

    it('routes listen actions through the entry speech handlers', async () => {
        const speakEntry = vi.fn();
        const speakFromEntry = vi.fn();
        const user = userEvent.setup();
        renderEntryViewMode({ speakEntry, speakFromEntry });

        await user.click(screen.getByTitle('Listen'));
        await user.click(screen.getByText('Read this entry'));

        expect(speakEntry).toHaveBeenCalledWith({
            id: 1,
            content: 'First entry',
            date: '2024-01-15',
        });

        await user.click(screen.getByTitle('Listen'));
        await user.click(screen.getByText('Read from here onwards'));

        expect(speakFromEntry).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ id: 1, content: 'First entry' }),
            ]),
            1,
        );
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

    it.each([
        ['dark', 'text-gray-400'],
        ['light', 'text-gray-500'],
    ] as const)('shows the empty history and revision times in the %s theme muted text color', async (theme, colorClass) => {
        const onFetchHistory = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(mockRevisions);
        const user = userEvent.setup();
        const { unmount } = renderEntryViewMode({ config: { theme }, onFetchHistory });

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('View history'));
        expect(await screen.findByText('No revisions')).toHaveClass(colorClass);
        unmount();

        renderEntryViewMode({ config: { theme }, onFetchHistory });
        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('View history'));
        const createdAt = new Date(mockRevisions[0]!.createdAt).toLocaleString();
        expect(await screen.findByText(createdAt)).toHaveClass(colorClass);
    });

    it('closes history without refetching when view history is selected again', async () => {
        const onFetchHistory = vi.fn().mockResolvedValue(mockRevisions);
        const user = userEvent.setup();
        renderEntryViewMode({ onFetchHistory });

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('View history'));
        expect(await screen.findByText('Older revision')).toBeInTheDocument();

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('View history'));

        expect(onFetchHistory).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Older revision')).not.toBeInTheDocument();
    });

    it('deletes a loaded revision and removes it from the history panel', async () => {
        const onFetchHistory = vi.fn().mockResolvedValue(mockRevisions);
        const onDeleteRevision = vi.fn().mockResolvedValue(true);
        const loadedRevision = mockRevisions[0]!;
        const user = userEvent.setup();
        renderEntryViewMode({ onFetchHistory, onDeleteRevision });

        await user.click(screen.getByLabelText('More actions'));
        await user.click(screen.getByTitle('View history'));
        expect(await screen.findByText('Older revision')).toBeInTheDocument();

        await user.click(screen.getAllByTitle('Delete')[0] as HTMLElement);

        expect(onDeleteRevision).toHaveBeenCalledWith(1, loadedRevision.id);
        expect(screen.queryByText('Older revision')).not.toBeInTheDocument();
    });
});

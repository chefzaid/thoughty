import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntriesList from './EntriesList';
import {
    createEntriesListProps,
    formatDate,
    mockEntries,
} from './EntriesList.test-utils';

describe('EntriesList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('displays loading message when loading with no existing entries', () => {
        render(<EntriesList {...createEntriesListProps({ loading: true, entries: [], groupedEntries: {} })} />);

        expect(screen.getByText('Loading entries...')).toBeInTheDocument();
    });

    it('keeps existing entries visible while refreshing', () => {
        render(<EntriesList {...createEntriesListProps({ loading: true })} />);

        expect(screen.getByText('Loading entries...')).toBeInTheDocument();
        expect(screen.getByText('First entry')).toBeInTheDocument();
        expect(screen.getByText('Second entry')).toBeInTheDocument();
    });

    it('displays no entries message when entries is empty', () => {
        render(<EntriesList {...createEntriesListProps({ entries: [], groupedEntries: {} })} />);

        expect(screen.getByText('No entries found.')).toBeInTheDocument();
    });

    it('renders date headers and applies the active target highlight class', () => {
        render(<EntriesList {...createEntriesListProps({ targetEntryId: 2 })} />);

        expect(screen.getByText('2024-01-15')).toBeInTheDocument();
        expect(screen.getByText('2024-01-14')).toBeInTheDocument();
        expect(document.getElementById('entry-2')).toHaveClass('highlight-entry');
        expect(document.getElementById('entry-1')).not.toHaveClass('highlight-entry');
    });

    it('shows pinned entries before date-grouped entries', () => {
        render(<EntriesList {...createEntriesListProps({
            entries: [
                { ...mockEntries[2], is_pinned: true },
                mockEntries[0],
                mockEntries[1],
            ],
            groupedEntries: {
                '2024-01-15': [mockEntries[0], mockEntries[1]],
                '2024-01-14': [{ ...mockEntries[2], is_pinned: true }],
            },
        })} />);

        const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

        expect(headings).toEqual(['Pinned entries', '2024-01-15']);
        expect(screen.getByText('Third entry')).toBeInTheDocument();
    });

    it('keeps best search matches first under their dates, with pinning and reordering off', () => {
        const onReorderEntries = vi.fn();
        render(<EntriesList {...createEntriesListProps({
            rankedOrder: true,
            onReorderEntries,
            entries: [
                mockEntries[2],
                { ...mockEntries[0], is_pinned: true },
                mockEntries[1],
            ],
        })} />);

        const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
        const cards = [...document.querySelectorAll('[id^="entry-"]')].map((card) => card.id);

        expect(headings).toEqual(['2024-01-14', '2024-01-15']);
        expect(cards).toEqual(['entry-3', 'entry-1', 'entry-2']);
        expect(screen.queryByTitle('Drag to reorder')).not.toBeInTheDocument();
    });

    it('applies the correct theme classes', () => {
        const { rerender } = render(<EntriesList {...createEntriesListProps({ config: { theme: 'dark' } })} />);

        expect(screen.getByText('2024-01-15')).toHaveClass('text-gray-300');

        rerender(<EntriesList {...createEntriesListProps({ config: { theme: 'light' } })} />);

        expect(screen.getByText('2024-01-15')).toHaveClass('text-gray-800');
    });

    it('shows the entry card accent style', () => {
        render(<EntriesList {...createEntriesListProps()} />);

        const firstCard = document.getElementById('entry-1');
        expect(firstCard?.style.borderLeftColor).toBe('rgb(42, 157, 143)');
        expect(firstCard?.style.borderLeftWidth).toBe('5px');
    });

    it('calls onReorderEntries when an entry is dropped onto another entry on the same day', () => {
        const onReorderEntries = vi.fn();
        render(<EntriesList {...createEntriesListProps({ onReorderEntries })} />);

        const dragHandles = screen.getAllByTitle('Drag to reorder');
        const targetCard = document.getElementById('entry-2');
        if (!targetCard) {
            throw new Error('Expected target entry card to exist');
        }

        fireEvent.pointerDown(dragHandles[0]!, { button: 0, pointerType: 'mouse' });

        const targetDropZone = targetCard.querySelector('button.absolute');
        if (!targetDropZone) {
            throw new Error('Expected target drop zone to exist');
        }

        fireEvent.pointerEnter(targetDropZone, { pointerType: 'mouse' });
        fireEvent.pointerUp(targetDropZone, { pointerType: 'mouse' });

        expect(onReorderEntries).toHaveBeenCalledWith('2024-01-15', [2, 1]);
    });

    it('lets only entries without a time be dragged, and reorders them among themselves', () => {
        const onReorderEntries = vi.fn();
        const day = [
            { ...mockEntries[0], id: 1, index: 1 },
            { ...mockEntries[1], id: 3, index: 3 },
            { ...mockEntries[1], id: 2, index: 2, content: 'Timed entry', time_of_day: '08:15' },
        ];
        render(<EntriesList {...createEntriesListProps({ onReorderEntries, entries: day, groupedEntries: { '2024-01-15': day } })} />);

        const dragHandles = screen.getAllByTitle('Drag to reorder');
        expect(dragHandles).toHaveLength(2);
        const timedCard = document.getElementById('entry-2');
        expect(timedCard?.querySelector('[title="Drag to reorder"]')).toBeNull();

        fireEvent.pointerDown(dragHandles[0]!, { button: 0, pointerType: 'mouse' });
        const targetDropZone = document.getElementById('entry-3')?.querySelector('button.absolute');
        if (!targetDropZone) {
            throw new Error('Expected target drop zone to exist');
        }
        fireEvent.pointerEnter(targetDropZone, { pointerType: 'mouse' });
        fireEvent.pointerUp(targetDropZone, { pointerType: 'mouse' });

        expect(onReorderEntries).toHaveBeenCalledWith('2024-01-15', [3, 1]);
    });

    it('offers no dragging on a day with a single entry without a time', () => {
        const day = [
            { ...mockEntries[0], id: 1, index: 1 },
            { ...mockEntries[1], id: 2, index: 2, time_of_day: '08:15' },
        ];
        render(<EntriesList {...createEntriesListProps({ onReorderEntries: vi.fn(), entries: day, groupedEntries: { '2024-01-15': day } })} />);

        expect(screen.queryByTitle('Drag to reorder')).not.toBeInTheDocument();
    });

    it('edits the title and time of day of the entry being edited', async () => {
        const setEditTitle = vi.fn();
        const setEditTimeOfDay = vi.fn();
        const user = userEvent.setup();
        render(
            <EntriesList
                {...createEntriesListProps({
                    editingEntry: mockEntries[0],
                    editText: 'Edited content',
                    editTags: ['work'],
                    editDate: new Date('2024-01-15'),
                    editTitle: 'Old title',
                    setEditTitle,
                    editTimeOfDay: '09:30',
                    setEditTimeOfDay,
                })}
            />,
        );

        const title = screen.getByDisplayValue('Old title');
        fireEvent.change(title, { target: { value: 'New title' } });
        expect(setEditTitle).toHaveBeenCalledWith('New title');
        expect(screen.getByDisplayValue('09:30')).toHaveAttribute('type', 'time');
        await user.click(screen.getByRole('button', { name: 'entryTimeClear' }));
        expect(setEditTimeOfDay).toHaveBeenCalledWith('');
    });

    it('edits the mood of the entry being edited, under ids that do not look like entry cards', async () => {
        const setEditMood = vi.fn();
        const setEditFeelings = vi.fn();
        const user = userEvent.setup();
        render(
            <EntriesList
                {...createEntriesListProps({
                    editingEntry: mockEntries[0],
                    editText: 'Edited content',
                    editTags: ['work'],
                    editDate: new Date('2024-01-15'),
                    editMood: 4,
                    setEditMood,
                    editFeelings: ['calm'],
                    setEditFeelings,
                })}
            />,
        );

        const good = screen.getByRole('radio', { name: 'Good' });
        expect(good).toBeChecked();
        expect(good.id).toBe('edit-entry-1-mood-4');
        expect(document.querySelectorAll('[id^="entry-"] [id^="entry-"]')).toHaveLength(0);
        await user.click(screen.getByRole('radio', { name: 'Low' }));
        expect(setEditMood).toHaveBeenCalledWith(2);
        await user.click(screen.getByRole('button', { name: 'calm' }));
        expect(setEditFeelings).toHaveBeenCalledWith([]);
    });

    it('renders edit mode for the active entry and keeps others in view mode', () => {
        render(
            <EntriesList
                {...createEntriesListProps({
                    editingEntry: mockEntries[0],
                    editText: 'Edited content',
                    editTags: ['work'],
                    editDate: new Date('2024-01-15'),
                })}
            />,
        );

        expect(screen.getByDisplayValue('Edited content')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Second entry')).toBeInTheDocument();
        expect(screen.queryByText('First entry')).not.toBeInTheDocument();
    });

    it('updates edit state and submit handlers from the edit form', async () => {
        const setEditText = vi.fn();
        const setEditDate = vi.fn();
        const onSaveEdit = vi.fn();
        const onCancelEdit = vi.fn();
        const user = userEvent.setup();
        render(
            <EntriesList
                {...createEntriesListProps({
                    editingEntry: mockEntries[0],
                    editText: 'Edited content',
                    editTags: ['work'],
                    editDate: new Date('2024-01-15'),
                    setEditText,
                    setEditDate,
                    onSaveEdit,
                    onCancelEdit,
                })}
            />,
        );

        await user.type(screen.getByDisplayValue('Edited content'), ' more');
        fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '2024-03-01' } });
        await user.click(screen.getByText('Save'));
        await user.click(screen.getByText('Cancel'));

        expect(setEditText).toHaveBeenCalled();
        expect(formatDate(setEditDate.mock.calls[0]?.[0])).toBe('2024-03-01');
        expect(onSaveEdit).toHaveBeenCalledTimes(1);
        expect(onCancelEdit).toHaveBeenCalledTimes(1);
    });
});

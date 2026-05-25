import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntriesList from './EntriesList';

const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface Entry {
    id: number;
    date: string;
    index: number;
    content: string;
    tags: string[];
    visibility: 'public' | 'private';
    diary_id?: number | null;
    diary_name?: string;
    diary_icon?: string;
    diary_color?: string | null;
}

describe('EntriesList', () => {
    const mockEntries: Entry[] = [
        { id: 1, date: '2024-01-15', index: 1, content: 'First entry', tags: ['work', 'important'], visibility: 'private', diary_id: 1, diary_name: 'Work', diary_icon: '💼', diary_color: '#2A9D8F' },
        { id: 2, date: '2024-01-15', index: 2, content: 'Second entry', tags: ['personal'], visibility: 'public', diary_id: 2, diary_name: 'Personal', diary_icon: '📓', diary_color: '#E76F51' },
        { id: 3, date: '2024-01-14', index: 1, content: 'Third entry', tags: ['ideas'], visibility: 'private', diary_id: 1, diary_name: 'Work', diary_icon: '💼', diary_color: '#2A9D8F' }
    ];

    const mockGroupedEntries: Record<string, Entry[]> = {
        '2024-01-15': [mockEntries[0], mockEntries[1]],
        '2024-01-14': [mockEntries[2]]
    };

    const defaultProps = {
        loading: false,
        entries: mockEntries,
        groupedEntries: mockGroupedEntries,
        config: { theme: 'dark' as const },
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onToggleVisibility: vi.fn(),
        onToggleFavorite: vi.fn(),
        editingEntry: null as Entry | null,
        editText: '',
        setEditText: vi.fn(),
        editTags: [] as string[],
        setEditTags: vi.fn(),
        editDate: null as Date | null,
        setEditDate: vi.fn(),
        editVisibility: 'private' as const,
        setEditVisibility: vi.fn(),
        editFormat: 'plain' as const,
        setEditFormat: vi.fn(),
        allTags: ['work', 'personal', 'ideas', 'important'],
        onSaveEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onNavigateToEntry: vi.fn(),
        onShareEntry: vi.fn().mockResolvedValue(true),
        getEntryPermalink: (entryId: number) => `https://thoughty.test/?entry=${entryId}`,
        sourceEntry: null,
        targetEntryId: null,
        activeTargetId: null,
        onBackToSource: vi.fn(),
        t: (key: string, params?: { defaultValue?: string }): string => {
            const translations: Record<string, string> = {
                loadingEntries: params?.defaultValue || 'Loading entries...',
                noEntriesFound: 'No entries found.',
                edit: 'Edit',
                delete: 'Delete',
                save: 'Save',
                cancel: 'Cancel',
                public: 'Public',
                private: 'Private',
                publicTooltip: 'Public - visible to everyone',
                privateTooltip: 'Private - only you can see',
                entryPermalink: 'Open entry permalink',
                shareEntry: 'Share entry',
                entryLinkCopied: 'Entry link copied',
                listen: 'Listen',
                stopListening: 'Stop listening',
                listenThisEntry: 'Read this entry',
                listenFromHere: 'Read from here onwards',
            };
            // Handle replace logic if needed, but for now exact match or key
            if (key === 'filterTagsPlaceholder') return 'Filter by tags...';
            return translations[key] || key;
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Loading state', () => {
        it('displays loading message when loading with no existing entries', () => {
            render(<EntriesList {...defaultProps} loading={true} entries={[]} groupedEntries={{}} />);

            expect(screen.getByText('Loading entries...')).toBeInTheDocument();
        });

        it('keeps existing entries visible while refreshing', () => {
            render(<EntriesList {...defaultProps} loading={true} />);

            expect(screen.getByText('Loading entries...')).toBeInTheDocument();
            expect(screen.getByText('First entry')).toBeInTheDocument();
            expect(screen.getByText('Second entry')).toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('displays no entries message when entries is empty', () => {
            render(<EntriesList {...defaultProps} entries={[]} groupedEntries={{}} />);

            expect(screen.getByText('No entries found.')).toBeInTheDocument();
        });
    });

    describe('Entries display', () => {
        it('displays date headers', () => {
            render(<EntriesList {...defaultProps} />);

            expect(screen.getByText('2024-01-15')).toBeInTheDocument();
            expect(screen.getByText('2024-01-14')).toBeInTheDocument();
        });

        it('displays entry content', () => {
            render(<EntriesList {...defaultProps} />);

            expect(screen.getByText('First entry')).toBeInTheDocument();
            expect(screen.getByText('Second entry')).toBeInTheDocument();
            expect(screen.getByText('Third entry')).toBeInTheDocument();
        });

        it('displays entry tags', () => {
            render(<EntriesList {...defaultProps} />);

            expect(screen.getByText('#work')).toBeInTheDocument();
            expect(screen.getByText('#important')).toBeInTheDocument();
            expect(screen.getByText('#personal')).toBeInTheDocument();
            expect(screen.getByText('#ideas')).toBeInTheDocument();
        });

        it('applies custom tag color metadata to entry chips', () => {
            render(
                <EntriesList
                    {...defaultProps}
                    tagMetadata={{ work: { color: '#2563EB', category: 'Focus' } }}
                />
            );

            const workLabel = screen.getByText('#work');
            const chip = workLabel.parentElement;

            expect(screen.getByText('Focus')).toBeInTheDocument();
            expect(chip?.style.borderColor).toBe('rgba(37, 99, 235, 0.85)');
            expect(chip?.style.backgroundColor).toBe('rgba(37, 99, 235, 0.28)');
        });

        it('displays entry index', () => {
            render(<EntriesList {...defaultProps} />);

            const indices = screen.getAllByText(/#\d/);
            expect(indices.length).toBeGreaterThan(0);
        });

        it('displays diary badges when entries come from multiple diaries', () => {
            render(<EntriesList {...defaultProps} />);

            expect(screen.getAllByText('Work').length).toBeGreaterThan(0);
            expect(screen.getByText('Personal')).toBeInTheDocument();
        });

        it('shows a journal-colored accent line on each entry card', () => {
            render(<EntriesList {...defaultProps} />);

            const firstCard = document.getElementById('entry-1');
            const secondCard = document.getElementById('entry-2');

            expect(firstCard).not.toBeNull();
            expect(secondCard).not.toBeNull();
            expect(firstCard?.style.borderLeftColor).toBe('rgb(42, 157, 143)');
            expect(firstCard?.style.borderLeftWidth).toBe('5px');
            expect(firstCard?.style.borderLeftStyle).toBe('solid');
            expect(secondCard?.style.borderLeftColor).toBe('rgb(231, 111, 81)');
            expect(secondCard?.style.borderLeftWidth).toBe('5px');
            expect(secondCard?.style.borderLeftStyle).toBe('solid');
        });

        it('renders the highlight class on the targeted entry card', () => {
            render(<EntriesList {...defaultProps} targetEntryId={2} />);

            expect(document.getElementById('entry-2')).toHaveClass('highlight-entry');
            expect(document.getElementById('entry-1')).not.toHaveClass('highlight-entry');
        });
    });

    describe('Theme styling', () => {
        it('applies dark theme styles', () => {
            render(<EntriesList {...defaultProps} config={{ theme: 'dark' }} />);

            const dateHeader = screen.getByText('2024-01-15');
            expect(dateHeader).toHaveClass('text-gray-300');
        });

        it('applies light theme styles', () => {
            render(<EntriesList {...defaultProps} config={{ theme: 'light' }} />);

            const dateHeader = screen.getByText('2024-01-15');
            expect(dateHeader).toHaveClass('text-gray-800');
        });
    });

    describe('Edit and Delete buttons', () => {
        it('calls onEdit when edit button is clicked', async () => {
            const onEdit = vi.fn();
            const user = userEvent.setup();
            render(<EntriesList {...defaultProps} onEdit={onEdit} />);

            const editButtons = screen.getAllByTitle('Edit');
            await user.click(editButtons[0]);

            expect(onEdit).toHaveBeenCalledWith(mockEntries[0]);
        });

        it('calls onDelete when delete button is clicked', async () => {
            const onDelete = vi.fn();
            const user = userEvent.setup();
            render(<EntriesList {...defaultProps} onDelete={onDelete} />);

            const deleteButtons = screen.getAllByTitle('Delete');
            await user.click(deleteButtons[0]);

            expect(onDelete).toHaveBeenCalledWith(1);
        });

        it('renders a permalink and shares the entry when requested', async () => {
            const onShareEntry = vi.fn().mockResolvedValue(true);
            const user = userEvent.setup();
            render(<EntriesList {...defaultProps} onShareEntry={onShareEntry} />);

            const permalinkLinks = screen.getAllByLabelText('Open entry permalink');
            expect(permalinkLinks[0]).toHaveAttribute('href', 'https://thoughty.test/?entry=1');

            const shareButtons = screen.getAllByLabelText('Share entry');
            await user.click(shareButtons[0]);

            expect(onShareEntry).toHaveBeenCalledWith(mockEntries[0]);
        });

        it('renders the permalink action after the entry number', () => {
            render(<EntriesList {...defaultProps} />);

            const entryCard = document.getElementById('entry-1');
            const entryIndex = screen.getAllByText('#1')[0];
            const permalinkLink = screen.getAllByLabelText('Open entry permalink')[0];

            expect(entryCard).not.toBeNull();
            expect(entryCard?.compareDocumentPosition(entryIndex) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
            expect(entryIndex.compareDocumentPosition(permalinkLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });
    });

    describe('Reordering', () => {
        it('calls onReorderEntries when an entry is dropped onto another entry on the same day', () => {
            const onReorderEntries = vi.fn();
            render(<EntriesList {...defaultProps} onReorderEntries={onReorderEntries} />);

            const dragHandles = screen.getAllByTitle('Drag to reorder');
            const targetCard = document.getElementById('entry-2');

            expect(targetCard).not.toBeNull();
            if (!targetCard) {
                throw new Error('Expected target entry card to exist');
            }

            fireEvent.pointerDown(dragHandles[0], { button: 0, pointerType: 'mouse' });

            const targetDropZone = targetCard.querySelector('button.absolute');
            if (!targetDropZone) {
                throw new Error('Expected target drop zone to exist');
            }

            fireEvent.pointerEnter(targetDropZone, { pointerType: 'mouse' });
            fireEvent.pointerUp(targetDropZone, { pointerType: 'mouse' });

            expect(onReorderEntries).toHaveBeenCalledWith('2024-01-15', [2, 1]);
        });
    });

    describe('Edit mode', () => {
        const editModeProps = {
            ...defaultProps,
            editingEntry: mockEntries[0],
            editText: 'Edited content',
            editTags: ['work'],
            editDate: new Date('2024-01-15')
        };

        it('renders edit form when entry is being edited', () => {
            render(<EntriesList {...editModeProps} />);

            expect(screen.getByDisplayValue('Edited content')).toBeInTheDocument();
        });

        it('renders Save and Cancel buttons in edit mode', () => {
            render(<EntriesList {...editModeProps} />);

            expect(screen.getByText('Save')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });

        it('calls setEditText on textarea change', async () => {
            const setEditText = vi.fn();
            const user = userEvent.setup();
            render(<EntriesList {...editModeProps} setEditText={setEditText} />);

            const textarea = screen.getByDisplayValue('Edited content');
            await user.type(textarea, ' more');

            expect(setEditText).toHaveBeenCalled();
        });

        it('updates the edit date when a full date is typed', () => {
            const setEditDate = vi.fn();

            render(<EntriesList {...editModeProps} setEditDate={setEditDate} />);

            fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '2024-03-01' } });

            const updatedDate = setEditDate.mock.calls[0]?.[0];
            expect(updatedDate).toBeInstanceOf(Date);
            expect(formatDate(updatedDate)).toBe('2024-03-01');
        });

        it('calls onSaveEdit when Save is clicked', async () => {
            const onSaveEdit = vi.fn();
            const user = userEvent.setup();
            render(<EntriesList {...editModeProps} onSaveEdit={onSaveEdit} />);

            await user.click(screen.getByText('Save'));

            expect(onSaveEdit).toHaveBeenCalledTimes(1);
        });

        it('calls onCancelEdit when Cancel is clicked', async () => {
            const onCancelEdit = vi.fn();
            const user = userEvent.setup();
            render(<EntriesList {...editModeProps} onCancelEdit={onCancelEdit} />);

            await user.click(screen.getByText('Cancel'));

            expect(onCancelEdit).toHaveBeenCalledTimes(1);
        });

        it('shows view mode for non-edited entries', () => {
            render(<EntriesList {...editModeProps} />);

            // Second entry should still be in view mode
            expect(screen.getByText('Second entry')).toBeInTheDocument();
            // First entry should be in edit mode (showing textarea)
            expect(screen.queryByText('First entry')).not.toBeInTheDocument();
        });
    });
});

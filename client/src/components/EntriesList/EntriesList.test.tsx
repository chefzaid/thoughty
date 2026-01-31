import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntriesList from './EntriesList';

interface Entry {
    id: number;
    date: string;
    index: number;
    content: string;
    tags: string[];
    visibility: 'public' | 'private';
}

describe('EntriesList', () => {
    const mockEntries: Entry[] = [
        { id: 1, date: '2024-01-15', index: 1, content: 'First entry', tags: ['work', 'important'], visibility: 'private' },
        { id: 2, date: '2024-01-15', index: 2, content: 'Second entry', tags: ['personal'], visibility: 'public' },
        { id: 3, date: '2024-01-14', index: 1, content: 'Third entry', tags: ['ideas'], visibility: 'private' }
    ];

    const mockGroupedEntries: Record<string, Entry[]> = {
        '2024-01-15': [mockEntries[0]!, mockEntries[1]!],
        '2024-01-14': [mockEntries[2]!]
    };

    const defaultProps = {
        loading: false,
        entries: mockEntries,
        groupedEntries: mockGroupedEntries,
        config: { theme: 'dark' as const },
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onToggleVisibility: vi.fn(),
        editingEntry: null as Entry | null,
        editText: '',
        setEditText: vi.fn(),
        editTags: [] as string[],
        setEditTags: vi.fn(),
        editDate: null as Date | null,
        setEditDate: vi.fn(),
        editVisibility: 'private' as const,
        setEditVisibility: vi.fn(),
        allTags: ['work', 'personal', 'ideas', 'important'],
        onSaveEdit: vi.fn(),
        onCancelEdit: vi.fn(),
        onNavigateToEntry: vi.fn(),
        sourceEntry: null,
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
        it('displays loading message when loading', () => {
            render(<EntriesList {...defaultProps} loading={true} />);

            expect(screen.getByText('Loading entries...')).toBeInTheDocument();
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

        it('displays entry index', () => {
            render(<EntriesList {...defaultProps} />);

            const indices = screen.getAllByText(/#\d/);
            expect(indices.length).toBeGreaterThan(0);
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
            await user.click(editButtons[0]!);

            expect(onEdit).toHaveBeenCalledWith(mockEntries[0]);
        });

        it('calls onDelete when delete button is clicked', async () => {
            const onDelete = vi.fn();
            const user = userEvent.setup();
            render(<EntriesList {...defaultProps} onDelete={onDelete} />);

            const deleteButtons = screen.getAllByTitle('Delete');
            await user.click(deleteButtons[0]!);

            expect(onDelete).toHaveBeenCalledWith(1);
        });
    });

    describe('Edit mode', () => {
        const editModeProps = {
            ...defaultProps,
            editingEntry: mockEntries[0]!,
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

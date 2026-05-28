import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryForm from './EntryForm';

const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

describe('EntryForm', () => {
    const defaultProps = {
        newEntryText: '',
        setNewEntryText: vi.fn(),
        selectedDate: new Date('2024-01-15'),
        setSelectedDate: vi.fn(),
        tags: [] as string[],
        setTags: vi.fn(),
        visibility: 'private' as const,
        setVisibility: vi.fn(),
        format: 'plain' as const,
        setFormat: vi.fn(),
        allTags: ['work', 'personal'],
        formError: '',
        suggestingTags: false,
        onSuggestTags: vi.fn(),
        onSubmit: vi.fn((e) => e.preventDefault()),
        theme: 'dark' as const,
        t: (key: string) => {
            const translations: Record<string, string> = {
                whatsOnYourMind: "What's on your mind?",
                entryReferenceHint: 'Reference hint',
                save: 'Save',
                public: 'Public',
                private: 'Private',
                publicTooltip: 'Public - visible to everyone',
                privateTooltip: 'Private - only you can see',
                markdownEnabled: 'Markdown enabled',
                markdownDisabled: 'Markdown disabled',
                markdownToolbar: 'Markdown formatting toolbar',
                bold: 'Bold',
                italic: 'Italic',
                filterTagsPlaceholder: 'Filter by tags...',
                suggestTags: 'Auto-Tags',
                suggestingTags: 'Tagging...',
            };
            return translations[key] || key;
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Markdown toggle', () => {
        it('renders MD toggle button', () => {
            render(<EntryForm {...defaultProps} />);

            const mdButton = screen.getByText('MD');
            expect(mdButton).toBeInTheDocument();
        });

        it('shows inactive style when format is plain', () => {
            render(<EntryForm {...defaultProps} format="plain" />);

            const mdButton = screen.getByText('MD').closest('button');
            expect(mdButton).not.toHaveClass('border-indigo-500');
        });

        it('shows active style when format is markdown', async () => {
            render(<EntryForm {...defaultProps} format="markdown" />);

            await screen.findByTestId('md-editor');

            const mdButton = screen.getByText('MD').closest('button');
            expect(mdButton).toHaveClass('border-indigo-500');
        });

        it('calls setFormat when MD button is clicked', async () => {
            const setFormat = vi.fn();
            const user = userEvent.setup();
            render(<EntryForm {...defaultProps} setFormat={setFormat} />);

            await user.click(screen.getByText('MD').closest('button') as Element);

            expect(setFormat).toHaveBeenCalled();
        });
    });

    describe('Markdown editor', () => {
        it('does not show markdown editor when format is plain', () => {
            render(<EntryForm {...defaultProps} format="plain" />);

            expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
            expect(screen.getByPlaceholderText("What's on your mind?").tagName).toBe('TEXTAREA');
        });

        it('shows markdown editor when format is markdown', () => {
            render(<EntryForm {...defaultProps} format="markdown" />);

            const editorWrapper = document.querySelector('[data-color-mode]');
            expect(editorWrapper).toBeInTheDocument();
        });

        it('uses MDEditor component when markdown is active', () => {
            render(<EntryForm {...defaultProps} format="markdown" />);

            expect(screen.getByTestId('md-editor')).toBeInTheDocument();
        });

        it('updates markdown text and passes placeholder metadata to the editor', async () => {
            const setNewEntryText = vi.fn();
            render(<EntryForm {...defaultProps} format="markdown" setNewEntryText={setNewEntryText} />);

            const editor = await screen.findByTestId('md-editor');
            const textarea = editor.querySelector('textarea');

            expect(textarea).toHaveAttribute('placeholder', "What's on your mind?");
            expect(textarea).toHaveAttribute('title', 'Reference hint');

            fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: 'Markdown draft' } });

            expect(setNewEntryText).toHaveBeenCalledWith('Markdown draft');
        });
    });

    describe('Form submission', () => {
        it('updates the selected date when a full date is typed', () => {
            const setSelectedDate = vi.fn();

            render(<EntryForm {...defaultProps} setSelectedDate={setSelectedDate} />);

            fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '2024-02-20' } });

            const updatedDate = setSelectedDate.mock.calls[0]?.[0];
            expect(updatedDate).toBeInstanceOf(Date);
            expect(formatDate(updatedDate)).toBe('2024-02-20');
        });

        it('ignores cleared date values', () => {
            const setSelectedDate = vi.fn();

            render(<EntryForm {...defaultProps} setSelectedDate={setSelectedDate} />);

            fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '' } });

            expect(setSelectedDate).not.toHaveBeenCalled();
        });

        it('calls onSubmit when form is submitted', async () => {
            const onSubmit = vi.fn((e) => e.preventDefault());
            const user = userEvent.setup();
            render(<EntryForm {...defaultProps} onSubmit={onSubmit} />);

            await user.click(screen.getByText('Save'));

            expect(onSubmit).toHaveBeenCalled();
        });
    });

    describe('AI tag suggestions', () => {
        it('calls onSuggestTags when the suggest button is clicked', async () => {
            const onSuggestTags = vi.fn();
            const user = userEvent.setup();

            render(<EntryForm {...defaultProps} onSuggestTags={onSuggestTags} />);

            await user.click(screen.getByText('Auto-Tags'));

            expect(onSuggestTags).toHaveBeenCalled();
        });

        it('renders the fix writing action and invokes it', async () => {
            const onFixWriting = vi.fn();
            const user = userEvent.setup();

            render(
                <EntryForm
                    {...defaultProps}
                    onFixWriting={onFixWriting}
                    t={(key) => ({
                        ...Object.fromEntries(Object.entries({
                            whatsOnYourMind: "What's on your mind?",
                            entryReferenceHint: 'Reference hint',
                            save: 'Save',
                            public: 'Public',
                            private: 'Private',
                            publicTooltip: 'Public - visible to everyone',
                            privateTooltip: 'Private - only you can see',
                            markdownEnabled: 'Markdown enabled',
                            markdownDisabled: 'Markdown disabled',
                            filterTagsPlaceholder: 'Filter by tags...',
                            suggestTags: 'Auto-Tags',
                            suggestingTags: 'Tagging...',
                            fixWriting: 'Polish Writing',
                            fixingWriting: 'Polishing...',
                        })),
                    }[key] || key)}
                />,
            );

            await user.click(screen.getByRole('button', { name: 'Polish Writing' }));

            expect(onFixWriting).toHaveBeenCalledTimes(1);
        });

        it('disables optional AI actions while they are running', () => {
            render(
                <EntryForm
                    {...defaultProps}
                    fixingWriting={true}
                    suggestingTags={true}
                    onFixWriting={vi.fn()}
                    t={(key) => ({
                        ...Object.fromEntries(Object.entries({
                            whatsOnYourMind: "What's on your mind?",
                            entryReferenceHint: 'Reference hint',
                            save: 'Save',
                            public: 'Public',
                            private: 'Private',
                            publicTooltip: 'Public - visible to everyone',
                            privateTooltip: 'Private - only you can see',
                            markdownEnabled: 'Markdown enabled',
                            markdownDisabled: 'Markdown disabled',
                            filterTagsPlaceholder: 'Filter by tags...',
                            suggestTags: 'Auto-Tags',
                            suggestingTags: 'Tagging...',
                            fixWriting: 'Polish Writing',
                            fixingWriting: 'Polishing...',
                        })),
                    }[key] || key)}
                />,
            );

            expect(screen.getByRole('button', { name: 'Tagging...' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Polishing...' })).toBeDisabled();
        });
    });

    describe('Visibility', () => {
        it('falls back to private visibility when the value is null', async () => {
            const setVisibility = vi.fn();
            const user = userEvent.setup();
            render(<EntryForm {...defaultProps} visibility={null} setVisibility={setVisibility} />);

            const button = screen.getByTitle('Private - only you can see');
            await user.click(button);

            expect(setVisibility).toHaveBeenCalledTimes(1);
            expect(setVisibility.mock.calls[0]?.[0](null)).toBe('private');
        });
    });

    describe('Error display', () => {
        it('shows form error when provided', () => {
            render(<EntryForm {...defaultProps} formError="Content is required" />);

            expect(screen.getByText('Content is required')).toBeInTheDocument();
        });

        it('does not show error when empty', () => {
            const { container } = render(<EntryForm {...defaultProps} formError="" />);

            expect(container.querySelector('.text-red-400')).not.toBeInTheDocument();
        });
    });
});

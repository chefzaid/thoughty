import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryForm from './EntryForm';

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

            const mdButton = screen.getByText('MD').closest('button')!;
            expect(mdButton).not.toHaveClass('border-indigo-500');
        });

        it('shows active style when format is markdown', () => {
            render(<EntryForm {...defaultProps} format="markdown" />);

            const mdButton = screen.getByText('MD').closest('button')!;
            expect(mdButton).toHaveClass('border-indigo-500');
        });

        it('calls setFormat when MD button is clicked', async () => {
            const setFormat = vi.fn();
            const user = userEvent.setup();
            render(<EntryForm {...defaultProps} setFormat={setFormat} />);

            await user.click(screen.getByText('MD').closest('button')!);

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
    });

    describe('Form submission', () => {
        it('calls onSubmit when form is submitted', async () => {
            const onSubmit = vi.fn((e) => e.preventDefault());
            const user = userEvent.setup();
            render(<EntryForm {...defaultProps} onSubmit={onSubmit} />);

            await user.click(screen.getByText('Save'));

            expect(onSubmit).toHaveBeenCalled();
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

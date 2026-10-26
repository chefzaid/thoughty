import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryForm from './EntryForm';
import { getTranslation } from '../../utils/translations';

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
                tagPickerPlaceholder: 'tags...',
                suggestTags: 'Auto Tag',
                suggestingTags: 'Tagging...',
                getInspired: 'Get Inspired',
                inspirationTitle: 'A question for you',
                findingInspiration: 'Finding a question...',
                askAnotherQuestion: 'Ask another question',
                writeAboutThis: 'Write about this',
                inspirationError: 'Unable to find inspiration',
                retry: 'Retry',
                entryTitleLabel: 'Title (optional)',
                entryTitlePlaceholder: 'Title (optional)',
                entryTimeLabel: 'Time of day (optional)',
                entryDateLabel: 'Date of the entry',
                entryTimeNow: 'Now',
                entryTimeNowLabel: 'Set the time of day to now',
                entryTimeClear: 'Remove the time of day',
            };
            return translations[key] || key;
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('labels the date field and keeps the AI actions readable in the light theme', () => {
        render(<EntryForm {...defaultProps} theme="light" onSuggestTags={vi.fn()} />);

        expect(screen.getByLabelText('Date of the entry')).toHaveAttribute('id', 'composer-date');
        expect(screen.getByRole('button', { name: 'Auto Tag' })).toHaveClass('text-amber-800');
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
            expect(mdButton).toHaveClass('border-indigo-500', 'text-indigo-300');
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

        it('applies the saved font color to the plain textarea', () => {
            render(<EntryForm {...defaultProps} format="plain" fontColor="#123456" />);

            expect(screen.getByPlaceholderText("What's on your mind?")).toHaveStyle({
                color: 'rgb(18, 52, 86)',
            });
        });

        it('shows markdown editor when format is markdown', () => {
            render(<EntryForm {...defaultProps} format="markdown" />);

            const editorWrapper = document.querySelector('[data-color-mode]');
            expect(editorWrapper).toBeInTheDocument();
        });

        it('offers the Markdown help under the editor', async () => {
            render(<EntryForm {...defaultProps} format="markdown" />);

            expect(await screen.findByText('markdownHelpSummary')).toBeInTheDocument();
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

        it('applies the saved font color to the markdown editor textarea', async () => {
            render(<EntryForm {...defaultProps} format="markdown" fontColor="#123456" />);

            const editor = await screen.findByTestId('md-editor');
            expect(editor.querySelector('textarea')).toHaveStyle({
                color: 'rgb(18, 52, 86)',
            });
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

            await user.click(screen.getByRole('button', { name: 'Auto Tag' }));

            expect(onSuggestTags).toHaveBeenCalledWith();
            expect(screen.queryByRole('button', { name: 'Theme Tags' })).not.toBeInTheDocument();
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
                            tagPickerPlaceholder: 'tags...',
                            suggestTags: 'Auto Tag',
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
                            tagPickerPlaceholder: 'tags...',
                            suggestTags: 'Auto Tag',
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

        it('adds the inspiration question without replacing the current draft', async () => {
            const setNewEntryText = vi.fn();
            const user = userEvent.setup();
            render(
                <EntryForm
                    {...defaultProps}
                    newEntryText="Existing draft"
                    setNewEntryText={setNewEntryText}
                    onGetInspiration={vi.fn().mockResolvedValue('What deserves a fresh perspective?')}
                />,
            );

            await user.click(screen.getByRole('button', { name: 'Get Inspired' }));
            expect(await screen.findByText('What deserves a fresh perspective?')).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: 'Write about this' }));

            const updateDraft = setNewEntryText.mock.calls[0]?.[0] as
                | ((current: string) => string)
                | undefined;
            expect(updateDraft?.('Existing draft')).toBe(
                'Existing draft\n\nWhat deserves a fresh perspective?',
            );
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

    describe('Mood', () => {
        it('shows no mood field when the composer does not handle it', () => {
            render(<EntryForm {...defaultProps} />);

            expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        });

        it('records a mood with composer ids that entry cards never use', async () => {
            const setMood = vi.fn();
            const setFeelings = vi.fn();
            render(<EntryForm {...defaultProps} mood={null} setMood={setMood} feelings={[]} setFeelings={setFeelings} />);

            const radio = screen.getByRole('radio', { name: 'moodLevel4' });
            expect(radio.id).toBe('composer-mood-4');
            await userEvent.click(radio);
            expect(setMood).toHaveBeenCalledWith(4);

            await userEvent.click(screen.getByRole('button', { name: 'feelingsLegend' }));
            await userEvent.click(screen.getByRole('button', { name: 'feelingCalm' }));
            expect(setFeelings).toHaveBeenCalledWith(['calm']);
        });
    });

    describe('Title and time of day', () => {
        it('shows neither field when the composer does not handle them', () => {
            render(<EntryForm {...defaultProps} />);

            expect(screen.queryByLabelText('Title (optional)')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Time of day (optional)')).not.toBeInTheDocument();
        });

        it('edits the optional title', () => {
            const setTitle = vi.fn();
            render(<EntryForm {...defaultProps} title="" setTitle={setTitle} />);

            const input = screen.getByLabelText('Title (optional)');
            expect(input).toHaveValue('');
            expect(input).toHaveAttribute('maxLength', '200');
            fireEvent.change(input, { target: { value: 'Harbour' } });

            expect(setTitle).toHaveBeenCalledWith('Harbour');
        });

        it('starts without a time and sets the current time with Now', async () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date(2024, 0, 15, 7, 42));
            const setTimeOfDay = vi.fn();
            render(<EntryForm {...defaultProps} timeOfDay="" setTimeOfDay={setTimeOfDay} />);

            expect(screen.getByLabelText('Time of day (optional)')).toHaveValue('');
            await userEvent.click(screen.getByRole('button', { name: 'Now' }));

            expect(setTimeOfDay).toHaveBeenCalledWith('07:42');
            vi.useRealTimers();
        });

        it('takes a typed time and removes it again', async () => {
            const setTimeOfDay = vi.fn();
            const { rerender } = render(<EntryForm {...defaultProps} timeOfDay="" setTimeOfDay={setTimeOfDay} />);

            fireEvent.change(screen.getByLabelText('Time of day (optional)'), { target: { value: '21:15' } });
            expect(setTimeOfDay).toHaveBeenCalledWith('21:15');

            rerender(<EntryForm {...defaultProps} timeOfDay="21:15" setTimeOfDay={setTimeOfDay} />);
            expect(screen.queryByRole('button', { name: 'Now' })).not.toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', { name: 'Remove the time of day' }));

            expect(setTimeOfDay).toHaveBeenLastCalledWith('');
        });
    });

    describe('Focus mode', () => {
        it('opens focus mode on the draft, in the font settings, and writes into the composer', async () => {
            const user = userEvent.setup();
            const setNewEntryText = vi.fn();
            render(<EntryForm {...defaultProps} newEntryText="Draft" setNewEntryText={setNewEntryText} fontFamily="mono" fontSize={16} />);

            await user.click(screen.getByRole('button', { name: 'focusModeOpen' }));
            const text = screen.getByRole('textbox', { name: 'focusModeTextLabel' });
            expect(text).toHaveValue('Draft');
            expect(text).toHaveStyle({ fontSize: '20px' });
            await user.type(text, '!');

            expect(setNewEntryText).toHaveBeenCalledWith('Draft!');
            await user.keyboard('{Escape}');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Error display', () => {
        it('shows form error when provided', () => {
            render(<EntryForm {...defaultProps} formError="Content is required" />);

            expect(screen.getByText('Content is required')).toBeInTheDocument();
        });

        it.each([
            ['en', 'entryTextRequired', 'Please enter some text'],
            ['fr', 'entryTextRequired', 'Veuillez saisir du texte'],
            ['en', 'suggestTagsFailed', 'Unable to suggest tags. Check your OpenRouter API key and try again.'],
            ['fr', 'fixWritingNoChanges', 'Aucune correction n’était nécessaire.'],
        ] as const)('announces the %s form error %s in the reader\'s language', (language, key, expected) => {
            render(
                <EntryForm
                    {...defaultProps}
                    t={(text: string, params?: Record<string, string | number>) => getTranslation(language, text, params)}
                    formError={key}
                />,
            );

            expect(screen.getByText(expected)).toHaveAttribute('role', 'alert');
        });

        it('does not show error when empty', () => {
            const { container } = render(<EntryForm {...defaultProps} formError="" />);

            expect(container.querySelector('.text-red-400')).not.toBeInTheDocument();
        });
    });
});

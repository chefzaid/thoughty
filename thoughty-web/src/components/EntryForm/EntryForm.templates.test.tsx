import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryForm from './EntryForm';
import { getTranslation } from '../../utils/translations';

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
    allTags: ['work'],
    formError: '',
    onSubmit: vi.fn((event: { preventDefault: () => void }) => event.preventDefault()),
    theme: 'dark' as const,
    t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params),
};

describe('EntryForm templates', () => {
    const templates = [
        {
            id: 'builtin-daily',
            name: 'Daily reflection',
            content: 'What happened today?',
            tags: ['reflection'],
            visibility: 'private' as const,
            format: 'plain' as const,
            builtIn: true,
        },
        {
            id: 'custom-1',
            name: 'Meeting notes',
            content: '## Decisions',
            tags: ['meeting'],
            visibility: 'public' as const,
            format: 'markdown' as const,
            builtIn: false,
        },
    ];

    it('applies a selected template to the draft', async () => {
        const setNewEntryText = vi.fn();
        const setTags = vi.fn();
        const setVisibility = vi.fn();
        const setFormat = vi.fn();
        const user = userEvent.setup();

        render(
            <EntryForm
                {...defaultProps}
                entryTemplates={templates}
                setNewEntryText={setNewEntryText}
                setTags={setTags}
                setVisibility={setVisibility}
                setFormat={setFormat}
            />,
        );

        await user.selectOptions(screen.getByLabelText('Entry template'), 'custom-1');

        expect(setNewEntryText).toHaveBeenCalledWith('## Decisions');
        expect(setTags).toHaveBeenCalledWith(['meeting']);
        expect(setVisibility).toHaveBeenCalledWith('public');
        expect(setFormat).toHaveBeenCalledWith('markdown');
    });

    it('saves the current draft as a template under the name typed in the dialog', async () => {
        const onSaveTemplate = vi.fn();
        const onSubmit = vi.fn((e) => e.preventDefault());
        const user = userEvent.setup();

        render(
            <EntryForm
                {...defaultProps}
                onSubmit={onSubmit}
                newEntryText="What worked this week?"
                tags={['review']}
                visibility="private"
                format="markdown"
                onSaveTemplate={onSaveTemplate}
            />,
        );

        const saveTemplate = screen.getByRole('button', { name: 'Save template' });
        await user.click(saveTemplate);
        const dialog = screen.getByRole('dialog', { name: 'Save as a template' });
        expect(screen.getByLabelText('Template name')).toHaveFocus();

        await user.type(screen.getByLabelText('Template name'), '  Weekly review {Enter}');

        expect(onSaveTemplate).toHaveBeenCalledWith({
            name: 'Weekly review',
            content: 'What worked this week?',
            tags: ['review'],
            visibility: 'private',
            format: 'markdown',
        });
        expect(onSubmit).not.toHaveBeenCalled();
        expect(dialog).not.toBeInTheDocument();
        expect(saveTemplate).toHaveFocus();
    });

    it('closes the name dialog without saving on Cancel', async () => {
        const onSaveTemplate = vi.fn();
        const user = userEvent.setup();

        render(<EntryForm {...defaultProps} newEntryText="Draft" onSaveTemplate={onSaveTemplate} />);

        await user.click(screen.getByRole('button', { name: 'Save template' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onSaveTemplate).not.toHaveBeenCalled();
    });

    it('deletes a selected custom template', async () => {
        const onDeleteTemplate = vi.fn();
        const user = userEvent.setup();

        render(
            <EntryForm
                {...defaultProps}
                entryTemplates={templates}
                onDeleteTemplate={onDeleteTemplate}
            />,
        );

        await user.selectOptions(screen.getByLabelText('Entry template'), 'custom-1');
        await user.click(screen.getByRole('button', { name: 'Delete template' }));

        expect(onDeleteTemplate).toHaveBeenCalledWith('custom-1');
    });
});

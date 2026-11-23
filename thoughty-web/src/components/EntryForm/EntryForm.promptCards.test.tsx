import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryForm from './EntryForm';
import { getTranslation } from '../../utils/translations';

const composerProps = {
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
    allTags: [],
    formError: '',
    onSubmit: vi.fn((event) => event.preventDefault()),
    theme: 'dark' as const,
};

describe('EntryForm prompt cards', () => {
    it('draws a card without AI and adds its question to the draft as the AI questions are', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const setNewEntryText = vi.fn();
        const onPromptCardsDrawnChange = vi.fn();
        const user = userEvent.setup();
        render(
            <EntryForm
                {...composerProps}
                newEntryText="Existing draft"
                setNewEntryText={setNewEntryText}
                t={(key, params) => getTranslation('en', key, params)}
                promptCardsDrawn="gratitude-1"
                onPromptCardsDrawnChange={onPromptCardsDrawnChange}
            />,
        );
        expect(screen.queryByRole('button', { name: 'Get Inspired' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Draw a card' }));
        expect(onPromptCardsDrawnChange).toHaveBeenCalledWith('gratitude-1,gratitude-2');
        await user.click(screen.getByRole('button', { name: 'Write about this' }));

        const updateDraft = setNewEntryText.mock.calls[0]?.[0] as ((current: string) => string) | undefined;
        expect(updateDraft?.('Existing draft')).toBe(
            'Existing draft\n\nWhat do you own that you would quietly miss if it vanished tomorrow?',
        );
        vi.restoreAllMocks();
    });

    it('keeps Draw a card waiting until the cards drawn have loaded', () => {
        render(
            <EntryForm
                {...composerProps}
                t={(key, params) => getTranslation('en', key, params)}
                onPromptCardsDrawnChange={vi.fn()}
                promptCardsReady={false}
            />,
        );
        expect(screen.getByRole('button', { name: 'Draw a card' })).toBeDisabled();
    });
});

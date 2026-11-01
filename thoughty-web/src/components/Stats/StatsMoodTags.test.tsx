import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StatsMoodTags from './StatsMoodTags';
import { moodTranslations } from '../../utils/translations.mood';
import { fillTranslationParams } from '../../utils/translationParams';
import { QuietModeOn } from '../../test/quietMode';

type Language = 'en' | 'fr';
const translator = (language: Language) => (key: string, params?: Record<string, string | number>) =>
    fillTranslationParams(moodTranslations[language][key as keyof typeof moodTranslations.en] ?? key, params);
const t = translator('en');

const moods = {
    recordedEntries: 9,
    averageMood: 3.4,
    levels: [1, 2, 1, 3, 2],
    months: [],
    weekdays: [],
    topFeelings: [],
    goodMoodTags: [{ tag: 'family', entries: 4 }, { tag: 'walks', entries: 2 }],
    lowMoodTags: [{ tag: 'family', entries: 2 }],
};

describe('StatsMoodTags', () => {
    it('lists the tags on good and low moods with their entries, without judging them', () => {
        render(<StatsMoodTags moods={moods} themeClass="dark" language="en" t={t} />);

        const card = screen.getByRole('region', { name: 'Tags and moods' });
        const good = within(card).getByRole('list', { name: 'Good or very good' });
        const low = within(card).getByRole('list', { name: 'Low or very low' });
        expect(within(good).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['family4 entries', 'walks2 entries']);
        // The same tag can be in both lists, each with its own count
        expect(within(low).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['family2 entries']);
        expect(card).not.toHaveTextContent(/\b(bad|worse|should|try)\b/i);
        // Without a way to open the journal the tags are not buttons
        expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    });

    it('opens the journal filtered to a tag', async () => {
        const onOpenJournalTag = vi.fn();
        render(<StatsMoodTags moods={moods} themeClass="light" theme="light" language="en" t={t} onOpenJournalTag={onOpenJournalTag} />);

        const low = screen.getByRole('list', { name: 'Low or very low' });
        await userEvent.click(within(low).getByRole('button', { name: 'Show entries tagged family' }));

        expect(onOpenJournalTag).toHaveBeenCalledWith('family');
    });

    it('keeps the tags in their order and leaves out the counts in quiet mode', () => {
        render(<StatsMoodTags moods={moods} themeClass="dark" language="en" t={t} />, { wrapper: QuietModeOn });

        const good = screen.getByRole('list', { name: 'Good or very good' });
        expect(within(good).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['family', 'walks']);
        expect(screen.queryByText(/\d entr/)).not.toBeInTheDocument();
    });

    it('says gently when one list or both have no tag yet', () => {
        const { rerender } = render(<StatsMoodTags moods={{ ...moods, lowMoodTags: [] }} themeClass="dark" language="fr" t={translator('fr')} />);

        expect(screen.getByRole('region', { name: 'Tags et humeurs' })).toBeInTheDocument();
        expect(screen.getByText('2 entrées')).toBeInTheDocument();
        expect(screen.getByText('Aucun tag sur deux de ces entrées pour l’instant.')).toBeInTheDocument();

        rerender(<StatsMoodTags moods={{ ...moods, goodMoodTags: [], lowMoodTags: [] }} themeClass="dark" language="en" t={t} />);
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(screen.getByText(/When a tag comes back on a few entries/)).toBeInTheDocument();
    });

    it('shows the gentle note for a response from before the tag lists', () => {
        const { goodMoodTags: _good, lowMoodTags: _low, ...older } = moods;
        render(<StatsMoodTags moods={older as typeof moods} themeClass="dark" language="en" t={t} />);

        expect(screen.getByText(/When a tag comes back on a few entries/)).toBeInTheDocument();
    });

    it('is hidden until a mood is recorded', () => {
        const { container } = render(
            <StatsMoodTags moods={{ ...moods, recordedEntries: 0, goodMoodTags: [], lowMoodTags: [] }} themeClass="dark" language="en" t={t} />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});

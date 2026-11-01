import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StatsTopWords from './StatsTopWords';
import { topWordsTranslations } from '../../utils/translations.topWords';
import { fillTranslationParams } from '../../utils/translationParams';
import { QuietModeOn } from '../../test/quietMode';

type Language = 'en' | 'fr';
const translator = (language: Language) => (key: string, params?: Record<string, string | number>) =>
    fillTranslationParams(topWordsTranslations[language][key as keyof typeof topWordsTranslations.en] ?? key, params);
const t = translator('en');

const topWords = {
    month: '2026-11',
    words: [
        { word: 'jardin', count: 5 },
        { word: 'garden', count: 3 },
        { word: 'été', count: 2 },
    ],
};

describe('StatsTopWords', () => {
    it('ranks the month’s words with how many times each is used, blurred with the entry text', () => {
        render(<StatsTopWords topWords={topWords} themeClass="dark" language="en" t={t} />);

        const card = screen.getByRole('region', { name: 'Words you use most' });
        expect(card).toHaveTextContent('The words you used most in November, leaving out common English and French words.');
        const list = within(card).getByRole('list', { name: 'Words you use most' });
        expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['jardin5 times', 'garden3 times', 'été2 times']);
        expect(within(list).getByText('jardin')).toHaveClass('privacy-text');
        // Without a way to open the journal the words are not buttons
        expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    });

    it('searches the journal for a word', async () => {
        const onSearchJournal = vi.fn();
        render(<StatsTopWords topWords={topWords} themeClass="light" language="en" t={t} onSearchJournal={onSearchJournal} />);

        const button = screen.getByRole('button', { name: 'Search the journal for garden' });
        expect(button).toHaveClass('privacy-text');
        await userEvent.click(button);
        expect(onSearchJournal).toHaveBeenCalledWith('garden');
    });

    it('keeps the words in their order without their counts in quiet mode', () => {
        render(<StatsTopWords topWords={topWords} themeClass="dark" language="en" t={t} />, { wrapper: QuietModeOn });

        expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['jardin', 'garden', 'été']);
        expect(screen.getByRole('region', { name: 'Words you use most' })).not.toHaveTextContent(/\d/);
    });

    it('says in French that words will show, with the month named', () => {
        render(<StatsTopWords topWords={{ month: '2026-02', words: [] }} themeClass="dark" language="fr" t={translator('fr')} />);

        const card = screen.getByRole('region', { name: 'Les mots que vous employez le plus' });
        expect(card).toHaveTextContent('en février');
        expect(card).toHaveTextContent('Les mots que vous employez au moins deux fois ce mois-ci apparaîtront ici.');
        expect(within(card).queryByRole('list')).not.toBeInTheDocument();
    });

    it('counts in French', () => {
        render(
            <StatsTopWords topWords={{ month: '2026-11', words: [{ word: 'pluie', count: 2 }] }} themeClass="dark" language="fr" t={translator('fr')} onSearchJournal={vi.fn()} />,
        );

        expect(screen.getByRole('listitem')).toHaveTextContent('pluie2 fois');
        expect(screen.getByRole('button', { name: 'Rechercher « pluie » dans le journal' })).toBeInTheDocument();
    });
});

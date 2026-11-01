import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import StatsRecords from './StatsRecords';
import { getTranslation, type Language } from '../../utils/translations';
import { QuietModeOn } from '../../test/quietMode';

const records = {
    longestEntry: { entryId: 11, date: '2024-03-03', index: 2, words: 1240 },
    busiestDay: { date: '2025-06-14', entries: 5 },
    longestStreak: { days: 12, startDate: '2025-03-01', endDate: '2025-03-12' },
    earliestEntry: { entryId: 12, date: '2025-01-09', index: 1, time: '05:12' },
    latestEntry: { entryId: 13, date: '2025-02-01', index: 3, time: '23:48' },
    firstEntry: { entryId: 14, date: '2019-03-02', index: 1 },
};
const noRecords = {
    longestEntry: null,
    busiestDay: null,
    longestStreak: null,
    earliestEntry: null,
    latestEntry: null,
    firstEntry: null,
};

const renderRecords = (options: {
    language?: Language;
    quiet?: boolean;
    values?: typeof records | typeof noRecords;
    onOpenEntry?: (entryId: number) => void;
    onOpenJournalDay?: (date: string) => void;
} = {}) => {
    const language = options.language ?? 'en';
    return render(
        <StatsRecords
            records={options.values ?? records}
            themeClass="dark"
            language={language}
            t={(key, params) => getTranslation(language, key, params)}
            onOpenEntry={options.onOpenEntry}
            onOpenJournalDay={options.onOpenJournalDay}
        />,
        options.quiet ? { wrapper: QuietModeOn } : undefined,
    );
};

describe('StatsRecords', () => {
    it('shows each record and opens its entry, or the day that set it', () => {
        const onOpenEntry = vi.fn();
        const onOpenJournalDay = vi.fn();
        renderRecords({ onOpenEntry, onOpenJournalDay });

        const card = screen.getByRole('region', { name: 'Personal records' });
        expect(within(card).getAllByRole('listitem')).toHaveLength(6);
        expect(within(card).getByText('1,240 words')).toBeInTheDocument();
        expect(within(card).getByText('5 entries')).toBeInTheDocument();
        expect(within(card).getByText('12 days in a row')).toBeInTheDocument();
        expect(within(card).getByText('5:12 AM')).toBeInTheDocument();
        expect(within(card).getByText('11:48 PM')).toBeInTheDocument();
        expect(within(card).getByText('March 2, 2019')).toBeInTheDocument();

        fireEvent.click(within(card).getByRole('button', { name: 'Longest entry March 3, 2024 · #2' }));
        fireEvent.click(within(card).getByRole('button', { name: 'Earliest hour January 9, 2025 · #1' }));
        fireEvent.click(within(card).getByRole('button', { name: 'Latest hour February 1, 2025 · #3' }));
        fireEvent.click(within(card).getByRole('button', { name: 'Where it all began Read it again' }));
        expect(onOpenEntry.mock.calls).toEqual([[11], [12], [13], [14]]);

        fireEvent.click(within(card).getByRole('button', { name: 'Busiest day June 14, 2025' }));
        // The streak opens on its first day
        fireEvent.click(within(card).getByRole('button', { name: 'Longest streak March 1 – 12, 2025' }));
        expect(onOpenJournalDay.mock.calls).toEqual([['2025-06-14'], ['2025-03-01']]);
    });

    it('keeps only the records that say when in quiet mode, without a count', () => {
        renderRecords({ quiet: true, onOpenEntry: vi.fn() });

        const card = screen.getByRole('region', { name: 'Personal records' });
        expect(within(card).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
            'Earliest hour',
            'Latest hour',
            'Where it all began',
        ]);
        expect(within(card).queryByText(/words|entries|in a row/)).not.toBeInTheDocument();
        expect(within(card).getByText('5:12 AM')).toBeInTheDocument();
    });

    it('speaks French, and leaves the links inert without a way to open them', () => {
        renderRecords({ language: 'fr' });

        const card = screen.getByRole('region', { name: 'Records personnels' });
        expect(within(card).getByText('1 240 mots')).toBeInTheDocument();
        expect(within(card).getByText('12 jours d’affilée')).toBeInTheDocument();
        expect(within(card).getByText('5:12')).toBeInTheDocument();
        expect(within(card).getByRole('button', { name: 'Entrée la plus longue 3 mars 2024 · nº 2' })).toBeDisabled();
        expect(within(card).getByRole('button', { name: 'Journée la plus remplie 14 juin 2025' })).toBeDisabled();
    });

    it('invites a new writer to write first, in quiet mode too', () => {
        renderRecords({ values: noRecords });
        expect(screen.getByText(/Your first entry starts the records/)).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('says one in the singular', () => {
        renderRecords({
            values: {
                ...records,
                longestEntry: { ...records.longestEntry, words: 1 },
                busiestDay: { date: '2025-06-14', entries: 1 },
                longestStreak: { days: 1, startDate: '2025-06-14', endDate: '2025-06-14' },
            },
        });
        expect(screen.getByText('1 word')).toBeInTheDocument();
        expect(screen.getByText('1 entry')).toBeInTheDocument();
        expect(screen.getByText('1 day in a row')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Longest streak June 14, 2025' })).toBeInTheDocument();
    });
});

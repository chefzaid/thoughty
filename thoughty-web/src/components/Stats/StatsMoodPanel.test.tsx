import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import StatsMoodPanel from './StatsMoodPanel';
import { moodTranslations } from '../../utils/translations.mood';

const t = (key: string, params?: Record<string, string | number>) => {
    let text: string = moodTranslations.en[key as keyof typeof moodTranslations.en] ?? key;
    for (const [name, value] of Object.entries(params ?? {})) {
        text = text.replace(`{${name}}`, String(value));
    }
    return text;
};

const moods = {
    recordedEntries: 6,
    averageMood: 3.7,
    levels: [0, 1, 1, 2, 2],
    months: [
        { month: '2025-01', average: 3, entries: 2 },
        { month: '2025-02', average: 4.5, entries: 2 },
        { month: '2025-04', average: 3.5, entries: 2 },
    ],
    weekdays: [
        { average: 4, entries: 3 },
        { average: null, entries: 0 },
        { average: 2, entries: 1 },
        { average: null, entries: 0 },
        { average: null, entries: 0 },
        { average: 5, entries: 2 },
        { average: null, entries: 0 },
    ],
    topFeelings: [{ feeling: 'calm', count: 4 }, { feeling: 'nostalgic', count: 1 }],
};

describe('StatsMoodPanel', () => {
    it('sums up the recorded moods with labels, not only numbers', () => {
        render(<StatsMoodPanel moods={moods} themeClass="dark" language="en" t={t} />);

        const panel = screen.getByRole('region', { name: 'Recorded moods' });
        expect(within(panel).getByText('No AI is involved', { exact: false })).toBeInTheDocument();
        expect(within(panel).getByText('Average mood').nextElementSibling).toHaveTextContent('3.7 out of 5 · Good');
        expect(within(panel).getByText('Entries with a mood').nextElementSibling).toHaveTextContent('6');
    });

    it('describes the mood over time for screen readers and as hover text, with a gap for a month without moods', () => {
        render(<StatsMoodPanel moods={moods} themeClass="light" language="en" t={t} />);

        const chart = screen.getByRole('img');
        expect(chart).toHaveAccessibleName(expect.stringContaining('February 2025: average 4.5 out of 5 (Very good) from 2 entries'));
        expect(screen.getByTitle('January 2025: average 3.0 out of 5 (Okay) from 2 entries')).toBeInTheDocument();
        // January and February are joined; April stands alone after the March gap
        expect(chart.querySelectorAll('polyline')).toHaveLength(1);
        expect(chart.querySelectorAll('.mood-point')).toHaveLength(3);
    });

    it('lists the mood by weekday from Monday and the feelings named most, curated ones translated', () => {
        render(<StatsMoodPanel moods={moods} themeClass="dark" language="fr" t={t} />);

        // English strings with French names and numbers, since the language picks the calendar and number format
        expect(screen.getByText('lundi: average 4,0 out of 5 from 3 entries')).toBeInTheDocument();
        expect(screen.getByText('mardi: no mood recorded')).toBeInTheDocument();
        expect(screen.getByText('samedi: average 5,0 out of 5 from 2 entries')).toBeInTheDocument();
        expect(screen.getByText('calm: 4 entries')).toBeInTheDocument();
        expect(screen.getByText('nostalgic: 1 entries')).toBeInTheDocument();
    });

    it('pages back through older months, the latest first', async () => {
        const months = Array.from({ length: 14 }, (_, index) => ({
            month: `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
            average: 3,
            entries: 1,
        }));
        render(<StatsMoodPanel moods={{ ...moods, months }} themeClass="dark" language="en" t={t} />);

        expect(screen.getByText('2 / 2')).toBeInTheDocument();
        expect(screen.getByTitle(/^February 2025/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Later months' })).toBeDisabled();

        await userEvent.click(screen.getByRole('button', { name: 'Earlier months' }));

        expect(screen.getByText('1 / 2')).toBeInTheDocument();
        expect(screen.getByTitle(/^January 2024/)).toBeInTheDocument();
        expect(screen.queryByTitle(/^February 2025/)).not.toBeInTheDocument();
    });

    it('invites the writer to record a mood when none is recorded yet', () => {
        render(
            <StatsMoodPanel
                moods={{ recordedEntries: 0, averageMood: null, levels: [0, 0, 0, 0, 0], months: [], weekdays: [], topFeelings: [] }}
                themeClass="dark"
                language="en"
                t={t}
            />,
        );

        expect(screen.getByText('Choose a mood when you write an entry to see how it changes over time.')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});

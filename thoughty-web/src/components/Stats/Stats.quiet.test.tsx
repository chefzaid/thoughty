import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import Stats from './Stats';
import { getTranslation } from '../../utils/translations';
import { QuietModeOn } from '../../test/quietMode';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return { useAuth: () => ({ authFetch }) };
});

vi.mock('react-chartjs-2', () => ({ Bar: () => createElement('div', { 'data-testid': 'mock-bar-chart' }) }));

vi.mock('chart.js', () => ({
    Chart: { register: vi.fn() },
    CategoryScale: {},
    LinearScale: {},
    BarElement: {},
    Title: {},
    Tooltip: {},
    Legend: {},
    ArcElement: {},
}));

const stats = {
    totalThoughts: 100,
    averageWordsPerEntry: 128,
    averageReadingTimeMinutes: 1,
    uniqueTagsCount: 15,
    thoughtsPerYear: { '2023': 40, '2024': 60 },
    thoughtsPerMonth: { '2024-01': 20 },
    thoughtsPerDay: { '2024-01-15': 2 },
    thoughtsPerTag: { work: 30 },
    tagsPerYear: { '2024': { work: 20 } },
    tagsPerMonth: {},
    toneMoodAnalysis: null,
    subjectAnalysis: null,
    correlations: { analyzedEntries: 0, entryConnections: [], tagConnections: [] },
    moods: {
        recordedEntries: 37,
        averageMood: 4,
        levels: [0, 0, 1, 1, 35],
        months: [{ month: '2024-01', average: 4, entries: 37 }],
        weekdays: Array.from({ length: 7 }, () => ({ average: null, entries: 0 })),
        topFeelings: [{ feeling: 'calm', count: 23 }],
    },
    goals: [{
        diaryId: 2,
        diaryName: 'Work',
        diaryIcon: '💼',
        goalType: 'entries_per_week' as const,
        goalTarget: 3,
        period: 'week' as const,
        periodStart: '2024-01-15',
        progress: 2,
        met: false,
        currentStreak: 1,
        longestStreak: 1,
        metPeriods: ['2024-01-08'],
    }],
};

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

describe('Stats in quiet mode', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
        (globalThis.fetch as Mock).mockResolvedValue({ ok: true, json: async () => stats });
    });

    it('keeps the readings of the journal and leaves out its counts, charts and goals', async () => {
        const { container } = render(
            <Stats theme="dark" t={t} diaryId={2} language="en" teaser={<p>Your year in review</p>} />,
            { wrapper: QuietModeOn },
        );

        const note = await screen.findByTestId('quiet-mode-note');
        expect(note).toHaveTextContent('Quiet mode is on, so counts and goals are hidden here.');
        expect(container.querySelector('.stats-summary')).toBeNull();
        expect(screen.queryByText('Total Entries')).not.toBeInTheDocument();
        expect(container.querySelector('#writing-goal-heading')).toBeNull();
        expect(container.querySelector('#journal-activity-heading')).toBeNull();
        expect(screen.queryAllByTestId('mock-bar-chart')).toHaveLength(0);
        expect(screen.queryByText('Top Tags by Year')).not.toBeInTheDocument();
        expect(screen.getByText('Your year in review')).toBeInTheDocument();

        // The moods stay, as an average without how many entries have one or how often a feeling came up
        const mood = screen.getByRole('region', { name: 'Recorded moods' });
        expect(within(mood).getByText('Average mood')).toBeInTheDocument();
        expect(within(mood).getByText('calm')).toBeInTheDocument();
        expect(within(mood).queryByText('37')).not.toBeInTheDocument();
        expect(within(mood).queryByText('23')).not.toBeInTheDocument();
        expect(mood.querySelector('.tone-mood-highlights')).toHaveClass('single');
    });
});

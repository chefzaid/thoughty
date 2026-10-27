import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import Stats from './Stats';
import { getTranslation } from '../../utils/translations';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return { useAuth: () => ({ authFetch }) };
});

vi.mock('react-chartjs-2', () => ({ Bar: () => createElement('div') }));

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

const goal = {
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
};

const stats = {
    totalThoughts: 0,
    averageWordsPerEntry: 0,
    averageReadingTimeMinutes: 0,
    uniqueTagsCount: 0,
    thoughtsPerYear: {},
    thoughtsPerMonth: {},
    thoughtsPerDay: { '2024-01-09': 3, '2024-01-15': 2 },
    thoughtsPerTag: {},
    tagsPerYear: {},
    tagsPerMonth: {},
    toneMoodAnalysis: null,
    subjectAnalysis: null,
    correlations: { analyzedEntries: 0, entryConnections: [], tagConnections: [] },
    goals: [goal],
};

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

describe('Stats writing goals', () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: new Date(2024, 0, 17, 23, 30), shouldAdvanceTime: true });
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => stats });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('asks for the goals up to the writer’s own day and marks the weeks that met the diary’s goal', async () => {
        const onManageDiaries = vi.fn();
        render(<Stats theme="light" t={t} diaryId={2} language="en" onManageDiaries={onManageDiaries} />);

        const panel = await screen.findByRole('region', { name: 'Writing goal' });
        expect(within(panel).getByText('3 entries a week')).toBeInTheDocument();
        expect(within(panel).getByText('2 of 3 entries this week')).toBeInTheDocument();
        expect((globalThis.fetch as Mock).mock.calls[0]?.[0]).toBe('/api/stats?diaryId=2&today=2024-01-17');

        expect(screen.getByRole('button', { name: '3 entries on Jan 9, 2024, weekly goal met' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '2 entries on Jan 15, 2024' })).toBeInTheDocument();
        expect(screen.getByText('Week that met the goal')).toBeInTheDocument();
    });

    it('explains that goals are per diary for all diaries and leaves the activity map unmarked', async () => {
        render(<Stats theme="dark" t={t} language="en" />);

        const panel = await screen.findByRole('region', { name: 'Writing goal' });
        expect(within(panel).getByText(/Pick one to see its goal/)).toBeInTheDocument();
        expect(within(panel).getByText('Work')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '3 entries on Jan 9, 2024' })).toBeInTheDocument();
        expect(screen.queryByText('Week that met the goal')).not.toBeInTheDocument();
    });

    it('offers to set a goal for a diary without one', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const onManageDiaries = vi.fn();
        render(<Stats theme="dark" t={t} diaryId={5} language="en" onManageDiaries={onManageDiaries} />);

        expect(await screen.findByText('This diary has no writing goal yet.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Set a writing goal' }));
        expect(onManageDiaries).toHaveBeenCalled();
    });
});

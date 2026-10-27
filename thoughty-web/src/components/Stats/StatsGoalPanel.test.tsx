import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StatsGoalPanel, { type DiaryGoalProgress } from './StatsGoalPanel';
import { getTranslation, type Language } from '../../utils/translations';

const wordsGoal: DiaryGoalProgress = {
    diaryId: 1,
    diaryName: 'Morning pages',
    diaryIcon: '☀️',
    goalType: 'words_per_day',
    goalTarget: 500,
    period: 'day',
    periodStart: '2026-10-27',
    progress: 650,
    met: true,
    currentStreak: 1,
    longestStreak: 12,
    metPeriods: ['2026-10-27'],
};
const entriesGoal: DiaryGoalProgress = {
    ...wordsGoal,
    diaryId: 2,
    diaryName: 'Work',
    diaryIcon: '💼',
    goalType: 'entries_per_week',
    goalTarget: 1,
    period: 'week',
    periodStart: '2026-10-26',
    progress: 0,
    met: false,
    currentStreak: 0,
    longestStreak: 2,
};

const renderPanel = (language: Language, goals: DiaryGoalProgress[], diaryId?: number) => render(
    <StatsGoalPanel
        goals={goals}
        diaryId={diaryId}
        themeClass="light"
        language={language}
        t={(key, params) => getTranslation(language, key, params)}
    />,
);

describe('StatsGoalPanel', () => {
    it.each([
        ['en', '500 words a day', '650 of 500 words today', 'Goal met today', 'Streak: 1 day', 'Best: 12 days'],
        ['fr', '500 mots par jour', '650 sur 500 mots aujourd’hui', 'Objectif atteint aujourd’hui', 'Série : 1 jour', 'Record : 12 jours'],
    ] as const)('shows the diary’s progress, whether it is met and its streaks in %s', (language, target, progress, met, streak, best) => {
        renderPanel(language, [wordsGoal], 1);

        for (const text of [target, progress, met, streak, best]) {
            expect(screen.getByText(text)).toBeInTheDocument();
        }
        const bar = screen.getByRole('progressbar', { name: progress });
        expect(bar).toHaveAttribute('value', '500');
        expect(bar).toHaveAttribute('max', '500');
    });

    it.each([
        ['en', '0 of 1 entry this week', 'Streak: 0 weeks', 'Best: 2 weeks'],
        ['fr', '0 sur 1 entrée cette semaine', 'Série : 0 semaine', 'Record : 2 semaines'],
    ] as const)('counts a weekly goal not met yet in %s', (language, progress, streak, best) => {
        renderPanel(language, [entriesGoal], 2);

        for (const text of [progress, streak, best]) {
            expect(screen.getByText(text)).toBeInTheDocument();
        }
        expect(screen.queryByText(/Goal met|Objectif atteint/)).not.toBeInTheDocument();
    });

    it('lists each diary’s goal for all diaries', () => {
        renderPanel('en', [wordsGoal, entriesGoal]);

        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
        expect(within(items[0]!).getByText('Morning pages')).toBeInTheDocument();
        expect(within(items[1]!).getByText(/1 entry a week/)).toBeInTheDocument();
        expect(within(items[1]!).getByText('0 of 1 entry this week')).toBeInTheDocument();
    });

    it('explains that goals are per diary when none has one, without a button it cannot follow', () => {
        renderPanel('fr', []);

        expect(screen.getByText('Les objectifs d’écriture se fixent par journal, et aucun n’en a encore.')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StatsActivityHeatmap from './StatsActivityHeatmap';
import { getTranslation, type Language } from '../../utils/translations';

const thoughtsPerDay = { '2024-01-15': 2, '2024-01-16': 1, '2024-01-18': 4 };

const renderHeatmap = (language: Language, onOpenJournalDay?: (date: string) => void) => render(
    <StatsActivityHeatmap
        thoughtsPerDay={thoughtsPerDay}
        themeClass="light"
        language={language}
        t={(key, params) => getTranslation(language, key, params)}
        onOpenJournalDay={onOpenJournalDay}
    />,
);

describe('StatsActivityHeatmap', () => {
    it.each([
        ['en', '0 entries on Jan 17, 2024', '1 entry on Jan 16, 2024', '2 entries on Jan 15, 2024'],
        ['fr', '0 entrée le 17 janv. 2024', '1 entrée le 16 janv. 2024', '2 entrées le 15 janv. 2024'],
    ] as const)('labels each day in the singular or plural in %s', (language, none, one, many) => {
        renderHeatmap(language, vi.fn());

        for (const label of [none, one, many]) {
            expect(screen.getByRole('button', { name: label })).toHaveAttribute('title', label);
        }
    });

    it.each([
        ['en', 'Jan', 'Feb', ['Mon', 'Wed', 'Fri']],
        ['fr', 'janv.', 'févr.', ['lun.', 'mer.', 'ven.']],
    ] as const)('names months and weekdays in %s', (language, january, february, weekdays) => {
        const { container } = renderHeatmap(language);

        const months = [...container.querySelectorAll('.heatmap-month-label')].map((label) => label.textContent);
        expect(months).toContain(january);
        expect(months).toContain(february);
        const days = [...container.querySelectorAll('.heatmap-weekday-label')].map((label) => label.textContent);
        // Weeks run from Monday, as writing goals count them
        expect(days).toEqual([weekdays[0], '', weekdays[1], '', weekdays[2], '', '']);
    });

    it('opens the journal on the clicked day and disables the days without a handler', async () => {
        const user = userEvent.setup();
        const onOpenJournalDay = vi.fn();
        const { unmount } = renderHeatmap('fr', onOpenJournalDay);

        await user.click(screen.getByRole('button', { name: '4 entrées le 18 janv. 2024' }));
        expect(onOpenJournalDay).toHaveBeenCalledWith('2024-01-18');
        unmount();

        renderHeatmap('en');
        expect(screen.getByRole('button', { name: '4 entries on Jan 18, 2024' })).toBeDisabled();
    });

    it.each([
        ['en', '4 entries on Jan 18, 2024, goal met', 'Day that met the goal'],
        ['fr', '4 entrées le 18 janv. 2024, objectif atteint', 'Jour où l’objectif est atteint'],
    ] as const)('marks the days that met a daily goal with a shape and in their names in %s', (language, label, legend) => {
        render(
            <StatsActivityHeatmap
                thoughtsPerDay={thoughtsPerDay}
                goal={{ period: 'day', metPeriods: ['2024-01-18'] }}
                themeClass="dark"
                language={language}
                t={(key, params) => getTranslation(language, key, params)}
            />,
        );

        expect(screen.getByRole('button', { name: label })).toHaveClass('goal-met');
        expect(document.querySelectorAll('button.goal-met')).toHaveLength(1);
        expect(screen.getByText(legend)).toBeInTheDocument();
        expect(document.querySelector('.heatmap-goal-row')).toBeNull();
    });

    it('marks the Monday-to-Sunday weeks that met a weekly goal under their column and in their days’ names', () => {
        const { container } = render(
            <StatsActivityHeatmap
                thoughtsPerDay={thoughtsPerDay}
                goal={{ period: 'week', metPeriods: ['2024-01-15'] }}
                themeClass="light"
                language="en"
                t={(key, params) => getTranslation('en', key, params)}
            />,
        );

        expect(screen.getByRole('button', { name: '2 entries on Jan 15, 2024, weekly goal met' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '0 entries on Jan 17, 2024, weekly goal met' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '0 entries on Jan 14, 2024' })).toBeInTheDocument();
        const marks = [...container.querySelectorAll('.heatmap-goal-row .heatmap-goal-week')].map((mark) => mark.textContent);
        expect(marks.filter(Boolean)).toEqual(['✓']);
        expect(marks.at(-1)).toBe('✓');
        expect(screen.getByText('Week that met the goal')).toBeInTheDocument();
    });
});

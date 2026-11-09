import { describe, expect, it, vi } from 'vitest';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StatsActivityHeatmap from './StatsActivityHeatmap';
import type { HeatmapGoal } from './heatmapDayDetails';
import { getTranslation, type Language } from '../../utils/translations';

const thoughtsPerDay = { '2024-01-15': 2, '2024-01-16': 1, '2024-01-18': 4 };

const renderHeatmap = (language: Language, onOpenJournalDay?: (date: string) => void, goal?: HeatmapGoal) => render(
    <StatsActivityHeatmap
        thoughtsPerDay={thoughtsPerDay}
        goal={goal}
        themeClass="light"
        language={language}
        t={(key, params) => getTranslation(language, key, params)}
        onOpenJournalDay={onOpenJournalDay}
    />,
);

const tooltip = () => screen.queryByTestId('heatmap-tooltip');
/** A press by finger: jsdom has no PointerEvent, so the pointer type rides on the event. */
const tap = (cell: HTMLElement) => {
    const press = createEvent.pointerDown(cell);
    Object.defineProperty(press, 'pointerType', { value: 'touch' });
    fireEvent(cell, press);
    fireEvent.click(cell);
};

describe('StatsActivityHeatmap', () => {
    it.each([
        ['en', 'Wednesday, January 17, 2024. No entries', 'Tuesday, January 16, 2024. 1 entry', 'Monday, January 15, 2024. 2 entries'],
        ['fr', 'mercredi 17 janvier 2024. Aucune entrée', 'mardi 16 janvier 2024. 1 entrée', 'lundi 15 janvier 2024. 2 entrées'],
    ] as const)('names each day by its long date and its entries, in the singular or plural, in %s', (language, none, one, many) => {
        renderHeatmap(language, vi.fn());

        for (const label of [none, one, many]) {
            // The details are the day's name, never a native title tooltip
            expect(screen.getByRole('gridcell', { name: label })).not.toHaveAttribute('title');
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

    it('opens the journal on the clicked day, and only describes the keys without a handler', async () => {
        const user = userEvent.setup();
        const onOpenJournalDay = vi.fn();
        const { unmount } = renderHeatmap('fr', onOpenJournalDay);

        await user.click(screen.getByRole('gridcell', { name: 'jeudi 18 janvier 2024. 4 entrées' }));
        expect(onOpenJournalDay).toHaveBeenCalledWith('2024-01-18');
        expect(screen.getByRole('grid')).toHaveAccessibleDescription(/Entrée ouvre le jour dans le journal/);
        unmount();

        renderHeatmap('en');
        await user.click(screen.getByRole('gridcell', { name: 'Thursday, January 18, 2024. 4 entries' }));
        expect(screen.getByRole('grid')).toHaveAccessibleDescription(
            'Arrow keys move by a day or a week, Page Up and Page Down by a month.',
        );
        expect(screen.getByRole('grid')).not.toHaveClass('opens-days');
    });

    it('shows a day’s details while the pointer is over it, and pops it out', async () => {
        const user = userEvent.setup();
        const onOpenJournalDay = vi.fn();
        renderHeatmap('en', onOpenJournalDay);
        const day = screen.getByRole('gridcell', { name: 'Monday, January 15, 2024. 2 entries' });

        await user.hover(day);
        expect(tooltip()).toHaveTextContent('Monday, January 15, 2024' + '2 entries');
        expect(tooltip()).toHaveAttribute('aria-hidden', 'true');
        expect(day).toHaveClass('tipped');

        await user.unhover(day);
        expect(tooltip()).not.toBeInTheDocument();
        expect(day).not.toHaveClass('tipped');
        expect(onOpenJournalDay).not.toHaveBeenCalled();
    });

    it('is one tab stop whose arrows move the active day, with its details beside it, and whose Enter or Space opens it', async () => {
        const user = userEvent.setup();
        const onOpenJournalDay = vi.fn();
        const { container } = renderHeatmap('en', onOpenJournalDay);
        const grid = screen.getByRole('grid', { name: 'Journal Activity by Day' });
        const activeName = () => document.getElementById(grid.getAttribute('aria-activedescendant') ?? '')?.getAttribute('aria-label');

        await user.tab();
        expect(grid).toHaveFocus();
        expect(container.querySelectorAll('[tabindex]')).toHaveLength(1);
        // The latest day with entries starts active, its details beside it
        expect(activeName()).toBe('Thursday, January 18, 2024. 4 entries');
        expect(tooltip()).toHaveTextContent('Thursday, January 18, 2024' + '4 entries');

        await user.keyboard('{ArrowUp}');
        expect(activeName()).toBe('Wednesday, January 17, 2024. No entries');
        expect(tooltip()).toHaveTextContent('Wednesday, January 17, 2024' + 'No entries');
        await user.keyboard('{ArrowLeft}');
        expect(activeName()).toBe('Wednesday, January 10, 2024. No entries');
        await user.keyboard('{ArrowRight}{ArrowRight}');
        // Past the last day, the active day stays on it
        expect(activeName()).toBe('Thursday, January 18, 2024. 4 entries');
        await user.keyboard('{Home}');
        expect(activeName()).toBe('Monday, January 15, 2024. 2 entries');
        expect(tooltip()).toHaveTextContent('Monday, January 15, 2024');
        await user.keyboard('{Escape}');
        expect(tooltip()).not.toBeInTheDocument();
        await user.keyboard('{Enter}');
        expect(onOpenJournalDay).toHaveBeenLastCalledWith('2024-01-15');
        await user.keyboard('{Control>}{Home}{/Control}');
        expect(activeName()).toBe('Monday, January 16, 2023. No entries');
        await user.keyboard(' ');
        expect(onOpenJournalDay).toHaveBeenLastCalledWith('2023-01-16');
        await user.keyboard('{Control>}{End}{/Control}{a}');
        expect(activeName()).toBe('Thursday, January 18, 2024. 4 entries');
        expect(onOpenJournalDay).toHaveBeenCalledTimes(2);

        // Leaving the map hides the details
        await user.tab();
        expect(tooltip()).not.toBeInTheDocument();
    });

    it('shows the details on a first tap and opens the day on a second', () => {
        const onOpenJournalDay = vi.fn();
        renderHeatmap('fr', onOpenJournalDay);
        const day = screen.getByRole('gridcell', { name: 'mardi 16 janvier 2024. 1 entrée' });

        tap(day);
        expect(onOpenJournalDay).not.toHaveBeenCalled();
        expect(tooltip()).toHaveTextContent('mardi 16 janvier 2024' + '1 entrée' + 'Touchez à nouveau pour ouvrir le jour');
        // Another day moves the details there
        tap(screen.getByRole('gridcell', { name: 'lundi 15 janvier 2024. 2 entrées' }));
        expect(tooltip()).toHaveTextContent('lundi 15 janvier 2024');
        expect(onOpenJournalDay).not.toHaveBeenCalled();

        tap(screen.getByRole('gridcell', { name: 'lundi 15 janvier 2024. 2 entrées' }));
        expect(onOpenJournalDay).toHaveBeenCalledWith('2024-01-15');
    });

    it('only shows the details on a tap when days do not open', () => {
        renderHeatmap('en');
        const day = screen.getByRole('gridcell', { name: 'Tuesday, January 16, 2024. 1 entry' });
        tap(day);
        tap(day);
        expect(tooltip()).toHaveTextContent('Tuesday, January 16, 2024' + '1 entry');
        expect(tooltip()).not.toHaveTextContent('Tap again');
    });

    it.each([
        ['en', 'Thursday, January 18, 2024. 4 entries. Daily goal met', 'Monday, January 15, 2024. 2 entries. Daily goal not met', 'Day that met the goal'],
        ['fr', 'jeudi 18 janvier 2024. 4 entrées. Objectif du jour atteint', 'lundi 15 janvier 2024. 2 entrées. Objectif du jour non atteint', 'Jour où l’objectif est atteint'],
    ] as const)('marks the days that met a daily goal with a shape, in their names and in their details in %s', async (language, met, missed, legend) => {
        const user = userEvent.setup();
        renderHeatmap(language, undefined, { period: 'day', metPeriods: ['2024-01-18'] });

        const metDay = screen.getByRole('gridcell', { name: met });
        expect(metDay).toHaveClass('goal-met');
        expect(screen.getByRole('gridcell', { name: missed })).not.toHaveClass('goal-met');
        expect(document.querySelectorAll('[role="gridcell"].goal-met')).toHaveLength(1);
        expect(screen.getByText(legend)).toBeInTheDocument();
        expect(document.querySelector('.heatmap-goal-row')).toBeNull();

        await user.hover(metDay);
        expect(tooltip()?.querySelector('.heatmap-tooltip-goal.met')).toHaveTextContent(met.split('. ').at(-1) ?? '');
    });

    it('marks the Monday-to-Sunday weeks that met a weekly goal under their column and in their days’ names', () => {
        const { container } = renderHeatmap('en', undefined, { period: 'week', metPeriods: ['2024-01-15'], periodStart: '2024-01-15' });

        expect(screen.getByRole('gridcell', { name: 'Monday, January 15, 2024. 2 entries. Weekly goal met' })).toBeInTheDocument();
        expect(screen.getByRole('gridcell', { name: 'Wednesday, January 17, 2024. No entries. Weekly goal met' })).toBeInTheDocument();
        expect(screen.getByRole('gridcell', { name: 'Sunday, January 14, 2024. No entries. Weekly goal not met' })).toBeInTheDocument();
        const marks = [...container.querySelectorAll('.heatmap-goal-row .heatmap-goal-week')].map((mark) => mark.textContent);
        expect(marks.filter(Boolean)).toEqual(['✓']);
        expect(marks.at(-1)).toBe('✓');
        expect(screen.getByText('Week that met the goal')).toBeInTheDocument();
    });

    it('says the running week is not met yet rather than missed', () => {
        renderHeatmap('en', undefined, { period: 'week', metPeriods: [], periodStart: '2024-01-15' });

        expect(screen.getByRole('gridcell', { name: 'Thursday, January 18, 2024. 4 entries. Weekly goal not met yet' })).toBeInTheDocument();
        expect(screen.getByRole('gridcell', { name: 'Sunday, January 14, 2024. No entries. Weekly goal not met' })).toBeInTheDocument();
    });

    it('says when there is nothing to map yet', () => {
        render(<StatsActivityHeatmap thoughtsPerDay={{}} themeClass="dark" language="en" t={(key, params) => getTranslation('en', key, params)} />);
        expect(screen.getByText('No journaling activity yet.')).toBeInTheDocument();
        expect(screen.queryByRole('grid')).not.toBeInTheDocument();
        // Nothing to explain without tiles
        expect(screen.queryByText('Less')).not.toBeInTheDocument();
    });

    it('puts the key under the map, the goal on the left and the shades from less to more on the right', () => {
        const { container } = renderHeatmap('fr', undefined, { period: 'week', metPeriods: [] });

        const legend = container.querySelector('.heatmap-legend');
        expect(legend?.textContent).toBe('✓' + 'Semaine où l’objectif est atteint' + 'Moins' + 'Plus');
        // After the map in the page, so a day's details (drawn above the day) never cover it
        expect(screen.getByRole('grid').compareDocumentPosition(legend!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(legend?.querySelectorAll('.heatmap-legend-scale .heatmap-cell')).toHaveLength(5);
    });
});

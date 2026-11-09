import { describe, expect, it } from 'vitest';

import { describeHeatmapDay, heatmapDateFormatter, heatmapDayLabel, type HeatmapGoal } from './heatmapDayDetails';
import { placeHeatmapTooltip } from './heatmapTooltipPlacement';
import { getTranslation, type Language } from '../../utils/translations';

const day = (dateKey: string, count: number, weekStart = '2024-01-15') => ({
    date: new Date(`${dateKey}T00:00:00.000Z`),
    dateKey,
    weekStart,
    count,
});

function describe_(language: Language, count: number, goal?: HeatmapGoal, dateKey = '2024-01-18') {
    return describeHeatmapDay(
        day(dateKey, count),
        goal,
        new Set(goal?.metPeriods ?? []),
        heatmapDateFormatter(language),
        language,
        (key, params) => getTranslation(language, key, params),
    );
}

describe('describeHeatmapDay', () => {
    it.each([
        ['en', 0, 'No entries'],
        ['en', 1, '1 entry'],
        ['en', 3, '3 entries'],
        ['en', 1200, '1,200 entries'],
        ['fr', 0, 'Aucune entrée'],
        ['fr', 1, '1 entrée'],
        ['fr', 3, '3 entrées'],
    ] as const)('in %s, says %i entries as “%s”', (language, count, entries) => {
        expect(describe_(language, count).entries).toBe(entries);
    });

    it.each([
        ['en', 'Thursday, January 18, 2024'],
        ['fr', 'jeudi 18 janvier 2024'],
    ] as const)('writes the long date in %s, whatever the reader’s time zone', (language, date) => {
        expect(describe_(language, 2).date).toBe(date);
    });

    it.each([
        ['en', 1, '1 word'],
        ['en', 1240, '1,240 words'],
        ['fr', 1, '1 mot'],
        ['fr', 1240, '1\u202f240 mots'],
    ] as const)('in %s, says %i words of the day as “%s”, in its details and its name', (language, words, text) => {
        const details = describeHeatmapDay(
            { ...day('2024-01-18', 2), words },
            undefined,
            new Set(),
            heatmapDateFormatter(language),
            language,
            (key, params) => getTranslation(language, key, params),
        );
        expect(details.words).toBe(text);
        expect(heatmapDayLabel(details)).toContain(`. ${text}`);
    });

    it('has no words line on a day without words', () => {
        expect(describe_('en', 0).words).toBeNull();
        expect(describeHeatmapDay(
            { ...day('2024-01-18', 1), words: 0 },
            { period: 'day', metPeriods: [] },
            new Set(),
            heatmapDateFormatter('en'),
            'en',
            (key, params) => getTranslation('en', key, params),
        ).words).toBeNull();
    });

    it('has no goal line without a goal', () => {
        expect(describe_('en', 2)).toMatchObject({ goal: null, goalMet: false });
        expect(heatmapDayLabel(describe_('en', 2))).toBe('Thursday, January 18, 2024. 2 entries');
    });

    it.each([
        ['en', ['2024-01-18'], 'Daily goal met', true],
        ['en', ['2024-01-17'], 'Daily goal not met', false],
        ['fr', ['2024-01-18'], 'Objectif du jour atteint', true],
        ['fr', [], 'Objectif du jour non atteint', false],
    ] as const)('in %s, a daily goal met on %j reads “%s”', (language, metPeriods, text, met) => {
        expect(describe_(language, 1, { period: 'day', metPeriods })).toMatchObject({ goal: text, goalMet: met });
    });

    it.each([
        ['en', ['2024-01-15'], undefined, 'Weekly goal met', true],
        ['en', [], undefined, 'Weekly goal not met', false],
        ['en', [], '2024-01-15', 'Weekly goal not met yet', false],
        ['fr', ['2024-01-15'], undefined, 'Objectif de la semaine atteint', true],
        ['fr', [], '2024-01-15', 'Objectif de la semaine pas encore atteint', false],
    ] as const)('in %s, a weekly goal (met %j, running from %s) reads “%s”', (language, metPeriods, periodStart, text, met) => {
        expect(describe_(language, 0, { period: 'week', metPeriods, periodStart })).toMatchObject({ goal: text, goalMet: met });
    });

    it('says today is not met yet for a daily goal still running', () => {
        expect(describe_('en', 0, { period: 'day', metPeriods: [], periodStart: '2024-01-18' }).goal).toBe('Daily goal not met yet');
        expect(heatmapDayLabel(describe_('fr', 0, { period: 'day', metPeriods: [], periodStart: '2024-01-18' })))
            .toBe('jeudi 18 janvier 2024. Aucune entrée. Objectif du jour pas encore atteint');
    });
});

describe('placeHeatmapTooltip', () => {
    const viewport = { width: 375, height: 800 };
    const tooltip = { width: 200, height: 60 };
    const anchor = (left: number, top: number) => new DOMRect(left, top, 12, 12);

    it('centres the tooltip above its day', () => {
        expect(placeHeatmapTooltip(anchor(180, 300), tooltip, viewport)).toEqual({ top: 232, left: 86, below: false });
    });

    it('keeps it inside the window near the left and right edges', () => {
        expect(placeHeatmapTooltip(anchor(2, 300), tooltip, viewport).left).toBe(8);
        expect(placeHeatmapTooltip(anchor(365, 300), tooltip, viewport).left).toBe(167);
    });

    it('goes below its day when there is no room above, and stays inside the bottom edge', () => {
        expect(placeHeatmapTooltip(anchor(180, 20), tooltip, viewport)).toEqual({ top: 40, left: 86, below: true });
        expect(placeHeatmapTooltip(anchor(180, 20), tooltip, { width: 375, height: 90 }).top).toBe(22);
    });

    it('pins a tooltip wider than the window to its left edge', () => {
        expect(placeHeatmapTooltip(anchor(100, 300), { width: 400, height: 60 }, viewport).left).toBe(8);
    });
});

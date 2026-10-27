import { useId, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import './StatsActivityHeatmap.css';
import './StatsGoals.css';

import { monthName, weekdayName } from '../../utils/calendarNames';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { moveHeatmapFocus } from './heatmapFocus';

interface HeatmapCell {
    date: Date;
    dateKey: string;
    count: number;
    level: number;
    inRange: boolean;
}

/** The days or Monday-to-Sunday weeks that met the diary's writing goal, each by its first day. */
export interface HeatmapGoal {
    readonly period: 'day' | 'week';
    readonly metPeriods: readonly string[];
}

interface StatsActivityHeatmapProps {
    readonly thoughtsPerDay: Record<string, number>;
    readonly goal?: HeatmapGoal;
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly onOpenJournalDay?: (date: string) => void | Promise<void>;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
/** Rows labelled down the side of the grid, from Monday (0): Monday, Wednesday and Friday. */
const LABELLED_ROWS = new Set([0, 2, 4]);

function addUtcDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_IN_MS);
}

function toUtcDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Weeks run from Monday to Sunday, as writing goals count them. */
function startOfUtcWeek(date: Date): Date {
    return addUtcDays(date, -((date.getUTCDay() + 6) % 7));
}

function getActivityLevel(count: number, maxCount: number): number {
    if (count <= 0 || maxCount <= 0) {
        return 0;
    }

    const ratio = count / maxCount;
    if (ratio >= 0.75) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
}

function buildHeatmapWeeks(thoughtsPerDay: Record<string, number>): HeatmapCell[][] {
    const allDays = Object.keys(thoughtsPerDay).sort((a, b) => a.localeCompare(b));
    const latestActivityDate = allDays.length > 0
        ? new Date(`${allDays.at(-1)}T00:00:00.000Z`)
        : new Date();
    const rangeEndDate = toUtcDateOnly(latestActivityDate);
    const rangeStartDate = startOfUtcWeek(addUtcDays(rangeEndDate, -364));
    const displayEndDate = addUtcDays(startOfUtcWeek(rangeEndDate), 6);
    const maxCount = Math.max(0, ...Object.values(thoughtsPerDay));
    const weeks: HeatmapCell[][] = [];

    for (
        let cursor = rangeStartDate;
        cursor.getTime() <= displayEndDate.getTime();
        cursor = addUtcDays(cursor, 7)
    ) {
        const week = Array.from({ length: 7 }, (_, dayIndex) => {
            const day = addUtcDays(cursor, dayIndex);
            const dateKey = day.toISOString().slice(0, 10);
            const count = thoughtsPerDay[dateKey] ?? 0;
            const inRange = day <= rangeEndDate;

            return {
                date: day,
                dateKey,
                count,
                level: inRange ? getActivityLevel(count, maxCount) : 0,
                inRange,
            };
        });

        weeks.push(week);
    }

    return weeks;
}

/**
 * A year of days, a column a week from Monday, shaded by the number of entries. The days form one grid
 * with a single tab stop: the arrows move the active day (announced through `aria-activedescendant`), and
 * Enter, Space or a click opens it in the journal. Keeping the days out of the tab order lets them stay
 * small, so the year fits on screen, while the grid itself is the large target.
 */
export default function StatsActivityHeatmap({
    thoughtsPerDay,
    goal,
    themeClass,
    language,
    t,
    onOpenJournalDay,
}: Readonly<StatsActivityHeatmapProps>) {
    const idPrefix = useId();
    const heatmapWeeks = useMemo(() => buildHeatmapWeeks(thoughtsPerDay), [thoughtsPerDay]);
    const metPeriods = useMemo(() => new Set(goal?.metPeriods ?? []), [goal]);
    const [chosenDate, setChosenDate] = useState<string | null>(null);
    const firstDate = heatmapWeeks[0]?.[0]?.dateKey ?? '';
    const lastDate = useMemo(
        () => heatmapWeeks.flat().filter((cell) => cell.inRange).at(-1)?.dateKey ?? firstDate,
        [firstDate, heatmapWeeks],
    );
    const activeDate = chosenDate && chosenDate >= firstDate && chosenDate <= lastDate ? chosenDate : lastDate;
    const weekdayLabels = useMemo(
        () => Array.from({ length: 7 }, (_, row) => (
            LABELLED_ROWS.has(row) ? weekdayName((row + 1) % 7, language, 'short') : ''
        )),
        [language],
    );
    const fullDateFormatter = useMemo(() => new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }), [language]);
    const monthLabels = useMemo(() => heatmapWeeks.map((week, index) => {
        const labelDate = week.find((cell) => cell.inRange)?.date ?? week[0]?.date;
        const previousDate = index > 0
            ? heatmapWeeks[index - 1]?.find((cell) => cell.inRange)?.date ?? heatmapWeeks[index - 1]?.[0]?.date
            : undefined;

        if (
            !labelDate
            || (
                previousDate?.getUTCMonth() === labelDate.getUTCMonth()
                && previousDate?.getUTCFullYear() === labelDate.getUTCFullYear()
            )
        ) {
            return '';
        }

        return monthName(labelDate.getUTCMonth() + 1, language, 'short');
    }), [heatmapWeeks, language]);

    const dayLabel = (cell: HeatmapCell, weekStart: string): string => {
        const countLabel = pluralPhrase(t, 'statsHeatmapDay', cell.count, language, {
            date: fullDateFormatter.format(cell.date),
        });
        if (goal?.period === 'day' && metPeriods.has(cell.dateKey)) return t('statsHeatmapGoalMetDay', { label: countLabel });
        if (goal?.period === 'week' && metPeriods.has(weekStart)) return t('statsHeatmapGoalMetWeek', { label: countLabel });
        return countLabel;
    };
    const cellId = (dateKey: string) => `${idPrefix}-day-${dateKey}`;
    const activeWeek = heatmapWeeks.find((week) => week.some((cell) => cell.dateKey === activeDate));
    const activeCell = activeWeek?.find((cell) => cell.dateKey === activeDate);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.metaKey) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void onOpenJournalDay?.(activeDate);
            return;
        }
        const next = moveHeatmapFocus(activeDate, event.key, event, firstDate, lastDate);
        if (next === null) return;
        event.preventDefault();
        setChosenDate(next);
        // The year can be wider than the card, so bring the day into view
        document.getElementById(cellId(next))?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        const date = event.target instanceof HTMLElement ? event.target.dataset['date'] : undefined;
        if (!date) return;
        setChosenDate(date);
        void onOpenJournalDay?.(date);
    };

    return (
        <section className={`chart-card heatmap-card ${themeClass}`} aria-labelledby="journal-activity-heading">
            <div className="chart-header heatmap-header">
                <h3 id="journal-activity-heading">{t('journalActivityByDay')}</h3>
                <div className="heatmap-legend">
                    <span>{t('lessActivity')}</span>
                    <div className="heatmap-legend-scale" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((level) => (
                            <span key={level} className={`heatmap-cell ${themeClass} level-${level}`} />
                        ))}
                    </div>
                    <span>{t('moreActivity')}</span>
                    {goal && (
                        <span className="heatmap-legend-goal">
                            {goal.period === 'day'
                                ? <span className={`heatmap-cell ${themeClass} level-2 goal-met`} aria-hidden="true" />
                                : <span className="heatmap-goal-week" aria-hidden="true">✓</span>}
                            {t(goal.period === 'day' ? 'statsHeatmapGoalLegendDay' : 'statsHeatmapGoalLegendWeek')}
                        </span>
                    )}
                </div>
            </div>

            {Object.keys(thoughtsPerDay).length === 0 ? (
                <p className="heatmap-empty">{t('noJournalActivity')}</p>
            ) : (
                <div className="heatmap-shell">
                    <div className="heatmap-grid">
                        <div className="heatmap-corner" aria-hidden="true" />
                        <div className="heatmap-month-row" aria-hidden="true">
                            {monthLabels.map((label, index) => (
                                <span key={`${label || 'blank'}-${index}`} className="heatmap-month-label">
                                    {label}
                                </span>
                            ))}
                        </div>
                        <div className="heatmap-weekday-column" aria-hidden="true">
                            {weekdayLabels.map((label, index) => (
                                <span key={`${label || 'weekday'}-${index}`} className="heatmap-weekday-label">
                                    {label}
                                </span>
                            ))}
                        </div>
                        {/* Each row is a week (drawn as a column); keys and clicks are handled by the grid */}
                        <div
                            className={`heatmap-weeks${onOpenJournalDay ? ' opens-days' : ''}`}
                            role="grid"
                            tabIndex={0}
                            aria-label={t('journalActivityByDay')}
                            aria-describedby={`${idPrefix}-hint`}
                            aria-activedescendant={cellId(activeDate)}
                            onKeyDown={handleKeyDown}
                            onClick={handleClick}
                        >
                            {heatmapWeeks.map((week) => {
                                const weekStart = week[0]?.dateKey ?? '';
                                return (
                                    <div key={weekStart} className="heatmap-week" role="row">
                                        {week.map((cell) => {
                                            if (!cell.inRange) {
                                                return (
                                                    <span
                                                        key={cell.dateKey}
                                                        className="heatmap-cell outside-range"
                                                        aria-hidden="true"
                                                    />
                                                );
                                            }

                                            const label = dayLabel(cell, weekStart);
                                            const dayMet = goal?.period === 'day' && metPeriods.has(cell.dateKey);
                                            const active = cell.dateKey === activeDate;
                                            return (
                                                <span
                                                    key={cell.dateKey}
                                                    id={cellId(cell.dateKey)}
                                                    role="gridcell"
                                                    data-date={cell.dateKey}
                                                    aria-label={label}
                                                    title={label}
                                                    className={`heatmap-cell ${themeClass} level-${cell.level}${dayMet ? ' goal-met' : ''}${active ? ' active' : ''}`}
                                                />
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                        {goal?.period === 'week' && (
                            <>
                                <div aria-hidden="true" />
                                <div className="heatmap-goal-row" aria-hidden="true">
                                    {heatmapWeeks.map((week) => (
                                        <span key={week[0]?.dateKey ?? 'week'} className="heatmap-goal-week">
                                            {metPeriods.has(week[0]?.dateKey ?? '') ? '✓' : ''}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <p id={`${idPrefix}-hint`} className="sr-only">
                        {t(onOpenJournalDay ? 'statsHeatmapKeyboardHint' : 'statsHeatmapKeyboardHintReadOnly')}
                    </p>
                    {/* The active day for sighted keyboard users; screen readers hear it from the grid */}
                    <p className="heatmap-active-day" aria-hidden="true">
                        {activeCell && activeWeek ? dayLabel(activeCell, activeWeek[0]?.dateKey ?? '') : ''}
                    </p>
                </div>
            )}
        </section>
    );
}

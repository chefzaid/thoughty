import {
    useId, useLayoutEffect, useMemo, useRef, useState,
    type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent,
} from 'react';
import './StatsActivityHeatmap.css';
import './StatsGoals.css';

import { monthName, weekdayName } from '../../utils/calendarNames';
import type { Language } from '../../utils/translations';
import { moveHeatmapFocus } from './heatmapFocus';
import { describeHeatmapDay, heatmapDateFormatter, heatmapDayLabel, type HeatmapGoal } from './heatmapDayDetails';
import StatsHeatmapLegend from './StatsHeatmapLegend';
import StatsHeatmapTooltip from './StatsHeatmapTooltip';

export type { HeatmapGoal } from './heatmapDayDetails';

interface HeatmapCell {
    date: Date;
    dateKey: string;
    /** The Monday of its week. */
    weekStart: string;
    count: number;
    level: number;
    inRange: boolean;
}

/** The day whose details show, and how it was reached: a touch shows them before a second one opens the day. */
interface HeatmapTip {
    readonly date: string;
    readonly via: 'pointer' | 'keyboard' | 'touch';
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
                weekStart: cursor.toISOString().slice(0, 10),
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
 * A year of days, a column a week from Monday, shaded by the number of entries, like a contribution
 * graph: small rounded tiles with a gap between them. The days form one grid with a single tab stop:
 * the arrows move the active day (announced through `aria-activedescendant`), and Enter, Space or a
 * click opens it in the journal. A day's details (its date, entries and goal) show beside it on hover,
 * on keyboard focus and on a first tap, which a second tap turns into opening the day; screen readers
 * hear the same details as the day's name. On a narrow screen the year scrolls inside its card,
 * starting on the latest weeks.
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
    const shellRef = useRef<HTMLDivElement>(null);
    // Whether the latest press was a touch, and whether a press (rather than the keyboard) is focusing the grid
    const touchPress = useRef(false);
    const pressing = useRef(false);
    const heatmapWeeks = useMemo(() => buildHeatmapWeeks(thoughtsPerDay), [thoughtsPerDay]);
    const metPeriods = useMemo(() => new Set(goal?.metPeriods ?? []), [goal]);
    const [chosenDate, setChosenDate] = useState<string | null>(null);
    const [tip, setTip] = useState<HeatmapTip | null>(null);
    const cells = useMemo(() => heatmapWeeks.flat().filter((cell) => cell.inRange), [heatmapWeeks]);
    const firstDate = heatmapWeeks[0]?.[0]?.dateKey ?? '';
    const lastDate = cells.at(-1)?.dateKey ?? firstDate;
    const activeDate = chosenDate && chosenDate >= firstDate && chosenDate <= lastDate ? chosenDate : lastDate;
    const weekdayLabels = useMemo(
        () => Array.from({ length: 7 }, (_, row) => (
            LABELLED_ROWS.has(row) ? weekdayName((row + 1) % 7, language, 'short') : ''
        )),
        [language],
    );
    const dateFormatter = useMemo(() => heatmapDateFormatter(language), [language]);
    const detailsByDate = useMemo(
        () => new Map(cells.map((cell) => [cell.dateKey, describeHeatmapDay(cell, goal, metPeriods, dateFormatter, language, t)])),
        [cells, dateFormatter, goal, language, metPeriods, t],
    );
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

    // The latest weeks matter most: start scrolled to them when the year is wider than the card
    useLayoutEffect(() => {
        const shell = shellRef.current;
        if (shell) shell.scrollLeft = shell.scrollWidth;
    }, [heatmapWeeks]);

    const cellId = (dateKey: string) => `${idPrefix}-day-${dateKey}`;
    const dateOf = (target: EventTarget) => (target instanceof HTMLElement ? target.dataset['date'] : undefined);
    const tipDetails = tip ? detailsByDate.get(tip.date) : undefined;

    const openDay = (date: string) => {
        setChosenDate(date);
        void onOpenJournalDay?.(date);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.metaKey) return;
        if (event.key === 'Escape') {
            setTip(null);
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void onOpenJournalDay?.(activeDate);
            return;
        }
        const next = moveHeatmapFocus(activeDate, event.key, event, firstDate, lastDate);
        if (next === null) return;
        event.preventDefault();
        setChosenDate(next);
        setTip({ date: next, via: 'keyboard' });
        // The year can be wider than the card, so bring the day into view
        document.getElementById(cellId(next))?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        touchPress.current = event.pointerType === 'touch';
        pressing.current = true;
    };

    const handlePointerOver = (event: PointerEvent<HTMLDivElement>) => {
        const date = dateOf(event.target);
        if (event.pointerType !== 'touch' && date) setTip({ date, via: 'pointer' });
    };

    const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'touch') setTip((current) => (current?.via === 'pointer' ? null : current));
    };

    const handleFocus = () => {
        // A press focuses the grid too; only the keyboard shows the active day's details on focus
        if (!pressing.current) setTip({ date: activeDate, via: 'keyboard' });
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        pressing.current = false;
        const date = dateOf(event.target);
        if (!date) return;
        // On a touch screen the first tap shows the day's details and a second one opens it
        if (touchPress.current && !(tip?.via === 'touch' && tip.date === date && onOpenJournalDay)) {
            setChosenDate(date);
            setTip({ date, via: 'touch' });
            return;
        }
        openDay(date);
    };

    const handleBlur = () => {
        pressing.current = false;
        setTip(null);
    };

    return (
        <section className={`chart-card heatmap-card ${themeClass}`} aria-labelledby="journal-activity-heading">
            <h2 id="journal-activity-heading">{t('journalActivityByDay')}</h2>

            {Object.keys(thoughtsPerDay).length === 0 ? (
                <p className="heatmap-empty">{t('noJournalActivity')}</p>
            ) : (
                <>
                    <div className="heatmap-shell" ref={shellRef}>
                        <div className="heatmap-grid" style={{ '--heatmap-weeks': heatmapWeeks.length } as CSSProperties}>
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
                            {/* Each row is a week (drawn as a column); keys, presses and clicks are handled by the grid */}
                            <div
                                className={`heatmap-weeks${onOpenJournalDay ? ' opens-days' : ''}`}
                                role="grid"
                                tabIndex={0}
                                aria-label={t('journalActivityByDay')}
                                aria-describedby={`${idPrefix}-hint`}
                                aria-activedescendant={cellId(activeDate)}
                                onKeyDown={handleKeyDown}
                                onPointerDown={handlePointerDown}
                                onPointerOver={handlePointerOver}
                                onPointerLeave={handlePointerLeave}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                onClick={handleClick}
                            >
                                {heatmapWeeks.map((week) => (
                                    <div key={week[0]?.weekStart} className="heatmap-week" role="row">
                                        {week.map((cell) => {
                                            const details = detailsByDate.get(cell.dateKey);
                                            if (!cell.inRange || !details) {
                                                return (
                                                    <span
                                                        key={cell.dateKey}
                                                        className="heatmap-cell outside-range"
                                                        aria-hidden="true"
                                                    />
                                                );
                                            }

                                            const dayMet = goal?.period === 'day' && details.goalMet;
                                            const active = cell.dateKey === activeDate;
                                            const tipped = cell.dateKey === tip?.date;
                                            return (
                                                <span
                                                    key={cell.dateKey}
                                                    id={cellId(cell.dateKey)}
                                                    role="gridcell"
                                                    data-date={cell.dateKey}
                                                    aria-label={heatmapDayLabel(details)}
                                                    className={`heatmap-cell ${themeClass} level-${cell.level}${dayMet ? ' goal-met' : ''}${active ? ' active' : ''}${tipped ? ' tipped' : ''}`}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                            {goal?.period === 'week' && (
                                <>
                                    <div aria-hidden="true" />
                                    <div className="heatmap-goal-row" aria-hidden="true">
                                        {heatmapWeeks.map((week) => (
                                            <span key={week[0]?.weekStart ?? 'week'} className="heatmap-goal-week">
                                                {metPeriods.has(week[0]?.weekStart ?? '') ? '✓' : ''}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <p id={`${idPrefix}-hint`} className="sr-only">
                            {t(onOpenJournalDay ? 'statsHeatmapKeyboardHint' : 'statsHeatmapKeyboardHintReadOnly')}
                        </p>
                        {tip && tipDetails && (
                            <StatsHeatmapTooltip
                                anchorId={cellId(tip.date)}
                                details={tipDetails}
                                hint={tip.via === 'touch' && onOpenJournalDay ? t('statsHeatmapTapToOpen') : undefined}
                                themeClass={themeClass}
                            />
                        )}
                    </div>
                    <StatsHeatmapLegend goal={goal} themeClass={themeClass} t={t} />
                </>
            )}
        </section>
    );
}

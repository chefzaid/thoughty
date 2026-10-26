import { useMemo } from 'react';

import { monthName, weekdayName } from '../../utils/calendarNames';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

interface HeatmapCell {
    date: Date;
    dateKey: string;
    count: number;
    level: number;
    inRange: boolean;
}

interface StatsActivityHeatmapProps {
    readonly thoughtsPerDay: Record<string, number>;
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly onOpenJournalDay?: (date: string) => void | Promise<void>;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
/** Weekdays labelled down the side of the grid (0 = Sunday), every other row. */
const LABELLED_WEEKDAYS = new Set([1, 3, 5]);

function addUtcDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_IN_MS);
}

function toUtcDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
    return addUtcDays(date, -date.getUTCDay());
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

export default function StatsActivityHeatmap({
    thoughtsPerDay,
    themeClass,
    language,
    t,
    onOpenJournalDay,
}: Readonly<StatsActivityHeatmapProps>) {
    const heatmapWeeks = useMemo(() => buildHeatmapWeeks(thoughtsPerDay), [thoughtsPerDay]);
    const weekdayLabels = useMemo(
        () => Array.from({ length: 7 }, (_, index) => (
            LABELLED_WEEKDAYS.has(index) ? weekdayName(index, language, 'short') : ''
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

    return (
        <section className={`chart-card heatmap-card ${themeClass}`} aria-labelledby="journal-activity-heading">
            <div className="chart-header heatmap-header">
                <h3 id="journal-activity-heading">{t('journalActivityByDay')}</h3>
                <div className="heatmap-legend" aria-label={`${t('lessActivity')} ${t('moreActivity')}`}>
                    <span>{t('lessActivity')}</span>
                    <div className="heatmap-legend-scale" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((level) => (
                            <span key={level} className={`heatmap-cell ${themeClass} level-${level}`} />
                        ))}
                    </div>
                    <span>{t('moreActivity')}</span>
                </div>
            </div>

            {Object.keys(thoughtsPerDay).length === 0 ? (
                <p className="heatmap-empty">{t('noJournalActivity')}</p>
            ) : (
                <div className="heatmap-shell">
                    <div className="heatmap-grid" role="img" aria-label={t('journalActivityByDay')}>
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
                        <div className="heatmap-weeks">
                            {heatmapWeeks.map((week) => (
                                <div key={week[0]?.dateKey ?? 'week'} className="heatmap-week">
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

                                        const dayLabel = pluralPhrase(t, 'statsHeatmapDay', cell.count, language, {
                                            date: fullDateFormatter.format(cell.date),
                                        });

                                        return (
                                            <button
                                                type="button"
                                                key={cell.dateKey}
                                                onClick={() => void onOpenJournalDay?.(cell.dateKey)}
                                                className={`heatmap-cell ${themeClass} level-${cell.level}`}
                                                aria-label={dayLabel}
                                                title={dayLabel}
                                                disabled={!onOpenJournalDay}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

import { useMemo } from 'react';

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
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly onOpenJournalDay?: (date: string) => void | Promise<void>;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
});

function addUtcDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_IN_MS);
}

const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, index) => {
    if (![1, 3, 5].includes(index)) {
        return '';
    }

    return WEEKDAY_FORMATTER.format(addUtcDays(new Date(Date.UTC(2024, 0, 7)), index));
});

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
    t,
    onOpenJournalDay,
}: Readonly<StatsActivityHeatmapProps>) {
    const heatmapWeeks = useMemo(() => buildHeatmapWeeks(thoughtsPerDay), [thoughtsPerDay]);
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

        return MONTH_FORMATTER.format(labelDate);
    }), [heatmapWeeks]);

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
                            {WEEKDAY_LABELS.map((label, index) => (
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

                                        const entryCountLabel = cell.count === 1 ? '1 entry' : `${cell.count} entries`;
                                        const fullDateLabel = FULL_DATE_FORMATTER.format(cell.date);

                                        return (
                                            <button
                                                type="button"
                                                key={cell.dateKey}
                                                onClick={() => void onOpenJournalDay?.(cell.dateKey)}
                                                className={`heatmap-cell ${themeClass} level-${cell.level}`}
                                                aria-label={`${entryCountLabel} on ${fullDateLabel}`}
                                                title={`${entryCountLabel} on ${fullDateLabel}`}
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

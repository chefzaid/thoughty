import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './Stats.css';
import { useAuth } from '../../contexts/AuthContext';
import type { components } from '../../generated/openapi';
import TagBadge from '../TagBadge/TagBadge';
import type { TagMetadataMap } from '../../utils/tagMetadata';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

interface StatsProps {
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly diaryId?: number | null;
    readonly onOpenJournalDay?: (date: string) => void | Promise<void>;
    readonly tagMetadata?: TagMetadataMap;
}

type StatsData = components['schemas']['StatsResponseDto'];

interface YearTagData {
    year: string;
    topTags: [string, number][];
}

interface HeatmapCell {
    date: Date;
    dateKey: string;
    count: number;
    level: number;
    inRange: boolean;
}

type ToneMoodAnalysis = NonNullable<StatsData['toneMoodAnalysis']>;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TAGS_YEARS_PER_PAGE = 5;
const YEARS_PER_PAGE = 8;
const MONTHS_PER_PAGE = 12;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
});
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, index) => {
    if (![1, 3, 5].includes(index)) {
        return '';
    }

    return WEEKDAY_FORMATTER.format(addUtcDays(new Date(Date.UTC(2024, 0, 7)), index));
});
const EMPTY_STATS: StatsData = {
    totalThoughts: 0,
    averageWordsPerEntry: 0,
    averageReadingTimeMinutes: 0,
    uniqueTagsCount: 0,
    thoughtsPerYear: {},
    thoughtsPerMonth: {},
    thoughtsPerDay: {},
    thoughtsPerTag: {},
    tagsPerYear: {},
    tagsPerMonth: {},
    toneMoodAnalysis: null,
};

function addUtcDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_IN_MS);
}

function toUtcDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDayKey(dayKey: string): Date {
    return new Date(`${dayKey}T00:00:00.000Z`);
}

function toDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date: Date): Date {
    return addUtcDays(date, -date.getUTCDay());
}

function endOfUtcWeek(date: Date): Date {
    return addUtcDays(startOfUtcWeek(date), 6);
}

function getActivityLevel(count: number, maxCount: number): number {
    if (count <= 0 || maxCount <= 0) {
        return 0;
    }

    const ratio = count / maxCount;
    if (ratio >= 0.75) {
        return 4;
    }

    if (ratio >= 0.5) {
        return 3;
    }

    if (ratio >= 0.25) {
        return 2;
    }

    return 1;
}

function buildHeatmapWeeks(thoughtsPerDay: Record<string, number>): HeatmapCell[][] {
    const allDays = Object.keys(thoughtsPerDay).sort((a, b) => a.localeCompare(b));
    const latestActivityDate = allDays.length > 0 ? parseDayKey(allDays.at(-1) ?? '') : new Date();
    const rangeEndDate = toUtcDateOnly(latestActivityDate);
    const rangeStartDate = startOfUtcWeek(addUtcDays(rangeEndDate, -364));
    const displayEndDate = endOfUtcWeek(rangeEndDate);
    const maxCount = Math.max(0, ...Object.values(thoughtsPerDay));
    const weeks: HeatmapCell[][] = [];

    for (let cursor = rangeStartDate; cursor.getTime() <= displayEndDate.getTime(); cursor = addUtcDays(cursor, 7)) {
        const week: HeatmapCell[] = [];

        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            const day = addUtcDays(cursor, dayIndex);
            const dateKey = toDayKey(day);
            const count = thoughtsPerDay[dateKey] ?? 0;
            const inRange = day.getTime() <= rangeEndDate.getTime();

            week.push({
                date: day,
                dateKey,
                count,
                level: inRange ? getActivityLevel(count, maxCount) : 0,
                inRange,
            });
        }

        weeks.push(week);
    }

    return weeks;
}

function formatInsightLabel(label: string): string {
    return label
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function getSortedInsightEntries(breakdown: ToneMoodAnalysis['moodBreakdown'] | ToneMoodAnalysis['toneBreakdown']) {
    return Object.entries(breakdown).sort(([, left], [, right]) => right - left);
}

function Stats({ theme, t, diaryId, onOpenJournalDay, tagMetadata }: StatsProps) {
    const { authFetch } = useAuth();
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Period selection states
    const [tagsYearPage, setTagsYearPage] = useState<number>(0);
    const [yearPage, setYearPage] = useState<number>(0);
    const [monthPage, setMonthPage] = useState<number>(0);

    const fetchStats = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (diaryId) params.append('diaryId', diaryId.toString());
            const response = await authFetch(`/api/stats?${params}`);
            if (!response.ok) throw new Error('Failed to fetch stats');
            const data = await response.json() as StatsData;
            setStats(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching stats:', err);
            setError('Failed to load statistics');
        } finally {
            setLoading(false);
        }
    }, [authFetch, diaryId]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const themeClass = theme === 'light' ? 'light' : 'dark';
    const textColor = theme === 'light' ? '#374151' : '#e5e7eb';
    const gridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    const effectiveStats = stats ?? EMPTY_STATS;

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: theme === 'light' ? '#fff' : '#1f2937',
                titleColor: textColor,
                bodyColor: textColor,
                borderColor: theme === 'light' ? '#e5e7eb' : '#374151',
                borderWidth: 1,
            },
        },
        scales: {
            x: {
                ticks: { color: textColor },
                grid: { color: gridColor },
            },
            y: {
                ticks: { color: textColor },
                grid: { color: gridColor },
                beginAtZero: true,
            },
        },
    }), [gridColor, textColor, theme]);

    const allYearLabels = useMemo(
        () => Object.keys(effectiveStats.thoughtsPerYear).sort((a, b) => a.localeCompare(b)),
        [effectiveStats.thoughtsPerYear],
    );
    const totalYearChartPages = Math.ceil(allYearLabels.length / YEARS_PER_PAGE);
    const thoughtsPerYearChart = useMemo(() => {
        const yearLabels = allYearLabels.slice(yearPage * YEARS_PER_PAGE, (yearPage + 1) * YEARS_PER_PAGE);

        return {
            labels: yearLabels,
            datasets: [
                {
                    data: yearLabels.map(year => effectiveStats.thoughtsPerYear[year]),
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                },
            ],
        };
    }, [allYearLabels, effectiveStats.thoughtsPerYear, yearPage]);

    const allMonthLabels = useMemo(
        () => Object.keys(effectiveStats.thoughtsPerMonth).sort((a, b) => a.localeCompare(b)),
        [effectiveStats.thoughtsPerMonth],
    );
    const totalMonthPages = Math.ceil(allMonthLabels.length / MONTHS_PER_PAGE);
    const thoughtsPerMonthChart = useMemo(() => {
        const monthLabels = allMonthLabels.slice(monthPage * MONTHS_PER_PAGE, (monthPage + 1) * MONTHS_PER_PAGE);

        return {
            labels: monthLabels.map(m => {
                const [year, month] = m.split('-');
                return `${MONTH_NAMES[Number.parseInt(month ?? '1', 10) - 1] ?? ''} ${year ?? ''}`;
            }),
            datasets: [
                {
                    data: monthLabels.map(month => effectiveStats.thoughtsPerMonth[month]),
                    backgroundColor: 'rgba(139, 92, 246, 0.7)',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                },
            ],
        };
    }, [allMonthLabels, effectiveStats.thoughtsPerMonth, monthPage]);

    const thoughtsPerTagChart = useMemo(() => {
        const tagEntries = Object.entries(effectiveStats.thoughtsPerTag).slice(0, 10);

        return {
            labels: tagEntries.map(([tag]) => tag),
            datasets: [
                {
                    data: tagEntries.map(([, count]) => count),
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(139, 92, 246, 0.7)',
                        'rgba(236, 72, 153, 0.7)',
                        'rgba(34, 197, 94, 0.7)',
                        'rgba(251, 146, 60, 0.7)',
                        'rgba(14, 165, 233, 0.7)',
                        'rgba(168, 85, 247, 0.7)',
                        'rgba(244, 63, 94, 0.7)',
                        'rgba(20, 184, 166, 0.7)',
                        'rgba(234, 179, 8, 0.7)',
                    ],
                    borderRadius: 6,
                },
            ],
        };
    }, [effectiveStats.thoughtsPerTag]);

    const allTagsPerYear: YearTagData[] = useMemo(() => Object.entries(effectiveStats.tagsPerYear)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([year, tags]) => ({
            year,
            topTags: Object.entries(tags)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5),
        })), [effectiveStats.tagsPerYear]);

    const totalTagsYearPages = Math.ceil(allTagsPerYear.length / TAGS_YEARS_PER_PAGE);
    const tagsPerYearData = useMemo(() => allTagsPerYear.slice(
        tagsYearPage * TAGS_YEARS_PER_PAGE,
        (tagsYearPage + 1) * TAGS_YEARS_PER_PAGE
    ), [allTagsPerYear, tagsYearPage]);
    const thoughtsPerDay = useMemo(
        () => effectiveStats.thoughtsPerDay ?? {},
        [effectiveStats.thoughtsPerDay],
    );
    const heatmapWeeks = useMemo(() => buildHeatmapWeeks(thoughtsPerDay), [thoughtsPerDay]);
    const heatmapMonthLabels = useMemo(() => heatmapWeeks.map((week, index) => {
        const labelDate = week.find((cell) => cell.inRange)?.date ?? week[0]?.date;
        const previousDate = index > 0
            ? heatmapWeeks[index - 1]?.find((cell) => cell.inRange)?.date ?? heatmapWeeks[index - 1]?.[0]?.date
            : undefined;

        if (!labelDate) {
            return '';
        }

        if (
            previousDate?.getUTCMonth() === labelDate.getUTCMonth()
            && previousDate?.getUTCFullYear() === labelDate.getUTCFullYear()
        ) {
            return '';
        }

        return MONTH_FORMATTER.format(labelDate);
    }), [heatmapWeeks]);
    const toneMoodAnalysis = effectiveStats.toneMoodAnalysis;
    const moodBreakdownEntries = useMemo(
        () => toneMoodAnalysis ? getSortedInsightEntries(toneMoodAnalysis.moodBreakdown) : [],
        [toneMoodAnalysis],
    );
    const toneBreakdownEntries = useMemo(
        () => toneMoodAnalysis ? getSortedInsightEntries(toneMoodAnalysis.toneBreakdown) : [],
        [toneMoodAnalysis],
    );

    if (loading) {
        return (
            <div className="stats-container">
                <div className="stats-loading">
                    <div className="spinner"></div>
                    <p>{t('loadingStats')}</p>
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="stats-container">
                <div className="stats-error">
                    <p>{error}</p>
                    <button onClick={fetchStats}>Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className={`stats-container ${themeClass}`}>
            <div className="stats-header">
                <h1>{t('stats')}</h1>
                <p>{t('statsOverview')}</p>
            </div>

            {/* Summary Cards */}
            <div className="stats-summary">
                <div className={`stat-card ${themeClass}`}>
                    <div className="stat-value">{stats.totalThoughts}</div>
                    <div className="stat-label">{t('totalEntries')}</div>
                </div>
                <div className={`stat-card ${themeClass}`}>
                    <div className="stat-value">{stats.uniqueTagsCount}</div>
                    <div className="stat-label">{t('uniqueTags')}</div>
                </div>
                <div className={`stat-card ${themeClass}`}>
                    <div className="stat-value">{allYearLabels.length}</div>
                    <div className="stat-label">{t('yearsActive')}</div>
                </div>
                <div className={`stat-card ${themeClass}`}>
                    <div className="stat-value">
                        {stats.totalThoughts && allYearLabels.length
                            ? Math.round(stats.totalThoughts / allYearLabels.length)
                            : 0}
                    </div>
                    <div className="stat-label">{t('avgPerYear')}</div>
                </div>
                <div className={`stat-card ${themeClass}`}>
                    <div className="stat-value">{stats.averageWordsPerEntry}</div>
                    <div className="stat-label">{t('avgWordsPerEntry')}</div>
                </div>
                <div className={`stat-card ${themeClass}`}>
                    <div className="stat-value">
                        {stats.averageReadingTimeMinutes > 0
                            ? `${stats.averageReadingTimeMinutes} min`
                            : '<1 min'}
                    </div>
                    <div className="stat-label">{t('avgReadingTime')}</div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="charts-grid">
                {stats.totalThoughts > 0 && (
                    <div className={`chart-card tone-mood-card ${themeClass}`}>
                        <div className="chart-header tone-mood-header">
                            <div>
                                <h3>{t('toneMoodInsights')}</h3>
                                <p className="tone-mood-description">{t('toneMoodInsightsDescription')}</p>
                            </div>
                            {toneMoodAnalysis && (
                                <div className={`tone-mood-sample ${themeClass}`}>
                                    <span>{t('analyzedEntries')}</span>
                                    <strong>{toneMoodAnalysis.analyzedEntries}</strong>
                                </div>
                            )}
                        </div>

                        {toneMoodAnalysis ? (
                            <>
                                <div className="tone-mood-highlights">
                                    <div className={`tone-mood-highlight ${themeClass}`}>
                                        <span className="tone-mood-highlight-label">{t('dominantMood')}</span>
                                        <strong>{formatInsightLabel(toneMoodAnalysis.dominantMood)}</strong>
                                    </div>
                                    <div className={`tone-mood-highlight ${themeClass}`}>
                                        <span className="tone-mood-highlight-label">{t('dominantTone')}</span>
                                        <strong>{formatInsightLabel(toneMoodAnalysis.dominantTone)}</strong>
                                    </div>
                                </div>

                                <p className="tone-mood-summary">{toneMoodAnalysis.summary}</p>

                                <div className="tone-mood-breakdowns">
                                    <div className="tone-mood-breakdown">
                                        <h4>{t('moodMix')}</h4>
                                        <ul className="tone-mood-list">
                                            {moodBreakdownEntries.map(([label, count]) => {
                                                const width = Math.max(8, Math.round((count / toneMoodAnalysis.analyzedEntries) * 100));

                                                return (
                                                    <li key={label} className="tone-mood-list-item">
                                                        <div className="tone-mood-list-labels">
                                                            <span>{formatInsightLabel(label)}</span>
                                                            <span>{count}</span>
                                                        </div>
                                                        <div className="tone-mood-bar-track" aria-hidden="true">
                                                            <span className="tone-mood-bar-fill mood" style={{ width: `${width}%` }} />
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>

                                    <div className="tone-mood-breakdown">
                                        <h4>{t('toneMix')}</h4>
                                        <ul className="tone-mood-list">
                                            {toneBreakdownEntries.map(([label, count]) => {
                                                const width = Math.max(8, Math.round((count / toneMoodAnalysis.analyzedEntries) * 100));

                                                return (
                                                    <li key={label} className="tone-mood-list-item">
                                                        <div className="tone-mood-list-labels">
                                                            <span>{formatInsightLabel(label)}</span>
                                                            <span>{count}</span>
                                                        </div>
                                                        <div className="tone-mood-bar-track" aria-hidden="true">
                                                            <span className="tone-mood-bar-fill tone" style={{ width: `${width}%` }} />
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="tone-mood-unavailable">{t('toneMoodUnavailable')}</p>
                        )}
                    </div>
                )}

                <div className={`chart-card heatmap-card ${themeClass}`}>
                    <div className="chart-header heatmap-header">
                        <h3>{t('journalActivityByDay')}</h3>
                        <div className="heatmap-legend" aria-label={`${t('lessActivity')} ${t('moreActivity')}`}>
                            <span>{t('lessActivity')}</span>
                            <div className="heatmap-legend-scale" aria-hidden="true">
                                {[0, 1, 2, 3, 4].map((level) => (
                                    <span
                                        key={level}
                                        className={`heatmap-cell ${themeClass} level-${level}`}
                                    />
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
                                    {heatmapMonthLabels.map((label, index) => (
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
                                                        onClick={() => {
                                                            void onOpenJournalDay?.(cell.dateKey);
                                                        }}
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
                </div>

                <div className="charts-row">
                    {/* Thoughts per Year */}
                    <div className={`chart-card ${themeClass}`}>
                        <div className="chart-header">
                            <h3>{t('thoughtsPerYear')}</h3>
                            {totalYearChartPages > 1 && (
                                <div className="pagination-controls">
                                    <button
                                        className={`pagination-btn ${themeClass}`}
                                        onClick={() => setYearPage(p => Math.max(0, p - 1))}
                                        disabled={yearPage === 0}
                                        title="Previous"
                                    >
                                        ←
                                    </button>
                                    <span className="pagination-info">
                                        {yearPage + 1} / {totalYearChartPages}
                                    </span>
                                    <button
                                        className={`pagination-btn ${themeClass}`}
                                        onClick={() => setYearPage(p => Math.min(totalYearChartPages - 1, p + 1))}
                                        disabled={yearPage === totalYearChartPages - 1}
                                        title="Next"
                                    >
                                        →
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="chart-wrapper">
                            <Bar data={thoughtsPerYearChart} options={chartOptions} />
                        </div>
                    </div>

                    {/* Thoughts per Month */}
                    <div className={`chart-card ${themeClass}`}>
                        <div className="chart-header">
                            <h3>{t('thoughtsPerMonth')}</h3>
                            {totalMonthPages > 1 && (
                                <div className="pagination-controls">
                                    <button
                                        className={`pagination-btn ${themeClass}`}
                                        onClick={() => setMonthPage(p => Math.max(0, p - 1))}
                                        disabled={monthPage === 0}
                                        title="Previous"
                                    >
                                        ←
                                    </button>
                                    <span className="pagination-info">
                                        {monthPage + 1} / {totalMonthPages}
                                    </span>
                                    <button
                                        className={`pagination-btn ${themeClass}`}
                                        onClick={() => setMonthPage(p => Math.min(totalMonthPages - 1, p + 1))}
                                        disabled={monthPage === totalMonthPages - 1}
                                        title="Next"
                                    >
                                        →
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="chart-wrapper">
                            <Bar data={thoughtsPerMonthChart} options={chartOptions} />
                        </div>
                    </div>
                </div>

                <div className="charts-row">
                    <div className={`chart-card ${themeClass}`}>
                        <h3>{t('topTags')}</h3>
                        <div className="chart-wrapper">
                            <Bar
                                data={thoughtsPerTagChart}
                                options={{
                                    ...chartOptions,
                                    indexAxis: 'y' as const,
                                }}
                            />
                        </div>
                    </div>

                    {/* Tags per Year Breakdown */}
                    <div className={`chart-card ${themeClass}`}>
                        <div className="chart-header">
                            <h3>{t('topTagsByYear')}</h3>
                            {totalTagsYearPages > 1 && (
                                <div className="pagination-controls">
                                    <button
                                        className={`pagination-btn ${themeClass}`}
                                        onClick={() => setTagsYearPage(p => Math.max(0, p - 1))}
                                        disabled={tagsYearPage === 0}
                                        title="Newer years"
                                    >
                                        ←
                                    </button>
                                    <span className="pagination-info">
                                        {tagsYearPage + 1} / {totalTagsYearPages}
                                    </span>
                                    <button
                                        className={`pagination-btn ${themeClass}`}
                                        onClick={() => setTagsYearPage(p => Math.min(totalTagsYearPages - 1, p + 1))}
                                        disabled={tagsYearPage === totalTagsYearPages - 1}
                                        title="Older years"
                                    >
                                        →
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="tag-breakdown">
                            <table className="tag-table">
                                <thead>
                                    <tr>
                                        <th>{t('year')}</th>
                                        <th>{t('topTags')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tagsPerYearData.map(({ year, topTags }) => (
                                        <tr key={year}>
                                            <td>{year}</td>
                                            <td>
                                                {topTags.map(([tag, count]) => (
                                                    <TagBadge
                                                        key={tag}
                                                        tag={tag}
                                                        metadata={tagMetadata}
                                                        theme={theme}
                                                        showHash={false}
                                                        size="xs"
                                                        suffix={` (${count})`}
                                                        className="mr-2"
                                                    />
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Stats;

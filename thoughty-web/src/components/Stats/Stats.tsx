import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    type ChartOptions,
} from 'chart.js';
import './Stats.css';
import { useAuth } from '../../contexts/AuthContext';
import type { components } from '../../generated/openapi';
import PageHeader from '../PageHeader/PageHeader';
import TagBadge from '../TagBadge/TagBadge';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import StatsActivityHeatmap from './StatsActivityHeatmap';
import StatsInsights from './StatsInsights';
import StatsPersonalityPanel from './StatsPersonalityPanel';
import StatsCorrelationGraph from './StatsCorrelationGraph';
import StatsMoodPanel from './StatsMoodPanel';
import StatsGoalPanel from './StatsGoalPanel';
import StatsPagination from './StatsPagination';
import StatsBarChart, { type StatsChartPoint } from './StatsBarChart';
import { monthName } from '../../utils/calendarNames';
import { formatEntryDate } from '../../utils/entryDate';
import { resolveLanguage } from '../../utils/language';

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
    readonly onManageDiaries?: () => void;
    readonly tagMetadata?: TagMetadataMap;
    readonly language?: string;
    /** Shown after the summary numbers, or under the title while they load. */
    readonly teaser?: ReactNode;
}

type StatsData = components['schemas']['StatsResponseDto'];

interface YearTagData {
    year: string;
    topTags: [string, number][];
}

const TAGS_YEARS_PER_PAGE = 5;
const YEARS_PER_PAGE = 8;
const MONTHS_PER_PAGE = 12;
const TAG_COLORS = [
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
];
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
    subjectAnalysis: null,
    correlations: {
        analyzedEntries: 0,
        entryConnections: [],
        tagConnections: [],
    },
    moods: {
        recordedEntries: 0,
        averageMood: null,
        levels: [0, 0, 0, 0, 0],
        months: [],
        weekdays: [],
        topFeelings: [],
    },
    goals: [],
};

function Stats({ theme, t, diaryId, onOpenJournalDay, onManageDiaries, tagMetadata, language, teaser }: StatsProps) {
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
            // Writing goals are measured up to the writer's own day
            params.append('today', formatEntryDate(new Date()));
            const response = await authFetch(`/api/stats?${params}`);
            if (!response.ok) throw new Error('Failed to fetch stats');
            const data = await response.json() as StatsData;
            setStats(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching stats:', err);
            setError('statsLoadError');
        } finally {
            setLoading(false);
        }
    }, [authFetch, diaryId]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const themeClass = theme === 'light' ? 'light' : 'dark';
    const uiLanguage = resolveLanguage(language);
    const textColor = theme === 'light' ? '#374151' : '#e5e7eb';
    const gridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    const effectiveStats = stats ?? EMPTY_STATS;

    const chartOptions = useMemo((): ChartOptions<'bar'> => ({
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
    const thoughtsPerYearPoints = useMemo((): StatsChartPoint[] => allYearLabels
        .slice(yearPage * YEARS_PER_PAGE, (yearPage + 1) * YEARS_PER_PAGE)
        .map((year) => ({ label: year, value: effectiveStats.thoughtsPerYear[year] ?? 0 })),
    [allYearLabels, effectiveStats.thoughtsPerYear, yearPage]);

    const allMonthLabels = useMemo(
        () => Object.keys(effectiveStats.thoughtsPerMonth).sort((a, b) => a.localeCompare(b)),
        [effectiveStats.thoughtsPerMonth],
    );
    const totalMonthPages = Math.ceil(allMonthLabels.length / MONTHS_PER_PAGE);
    const thoughtsPerMonthPoints = useMemo((): StatsChartPoint[] => allMonthLabels
        .slice(monthPage * MONTHS_PER_PAGE, (monthPage + 1) * MONTHS_PER_PAGE)
        .map((month) => {
            const [year, monthNumber] = month.split('-');
            return {
                label: `${monthName(Number(monthNumber), uiLanguage, 'short')} ${year ?? ''}`,
                value: effectiveStats.thoughtsPerMonth[month] ?? 0,
            };
        }),
    [allMonthLabels, effectiveStats.thoughtsPerMonth, monthPage, uiLanguage]);

    const thoughtsPerTagPoints = useMemo((): StatsChartPoint[] => Object.entries(effectiveStats.thoughtsPerTag)
        .slice(0, 10)
        .map(([tag, count]) => ({ label: tag, value: count })),
    [effectiveStats.thoughtsPerTag]);
    const tagChartOptions = useMemo((): ChartOptions<'bar'> => ({ ...chartOptions, indexAxis: 'y' }), [chartOptions]);

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
    const goals = effectiveStats.goals ?? EMPTY_STATS.goals;
    const diaryGoal = diaryId ? goals.find((goal) => goal.diaryId === diaryId) : undefined;

    const header = <PageHeader title={t('stats')} subtitle={t('statsOverview')} theme={themeClass} />;

    if (loading) {
        return (
            <div className="stats-container">
                {header}
                {teaser}
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
                {header}
                {teaser}
                <div className="stats-error">
                    <p>{t(error ?? 'statsLoadError')}</p>
                    <button type="button" onClick={fetchStats}>{t('retry')}</button>
                </div>
            </div>
        );
    }

    return (
        <div className={`stats-container ${themeClass}`}>
            {header}

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

            {teaser}

            {/* Charts Grid */}
            <div className="charts-grid">
                {stats.totalThoughts > 0 && (
                    <>
                        <StatsInsights
                            themeClass={themeClass}
                            toneMoodAnalysis={stats.toneMoodAnalysis}
                            subjectAnalysis={stats.subjectAnalysis}
                            t={t}
                        />
                        <StatsMoodPanel
                            moods={stats.moods ?? EMPTY_STATS.moods}
                            themeClass={themeClass}
                            language={uiLanguage}
                            t={t}
                        />
                        <StatsPersonalityPanel
                            themeClass={themeClass}
                            diaryId={diaryId}
                            t={t}
                        />
                        <StatsCorrelationGraph
                            correlations={stats.correlations ?? EMPTY_STATS.correlations}
                            themeClass={themeClass}
                            language={uiLanguage}
                            t={t}
                            onOpenJournalDay={onOpenJournalDay}
                        />
                    </>
                )}

                <StatsGoalPanel
                    goals={goals}
                    diaryId={diaryId}
                    themeClass={themeClass}
                    language={uiLanguage}
                    t={t}
                    onManageDiaries={onManageDiaries}
                />

                <StatsActivityHeatmap
                    thoughtsPerDay={thoughtsPerDay}
                    goal={diaryGoal}
                    themeClass={themeClass}
                    language={uiLanguage}
                    t={t}
                    onOpenJournalDay={onOpenJournalDay}
                />

                {stats.totalThoughts > 0 && (
                    <>
                        <div className="charts-row">
                            <StatsBarChart
                                title={t('thoughtsPerYear')}
                                labelHeader={t('year')}
                                points={thoughtsPerYearPoints}
                                backgroundColor="rgba(59, 130, 246, 0.7)"
                                borderColor="rgba(59, 130, 246, 1)"
                                options={chartOptions}
                                themeClass={themeClass}
                                language={uiLanguage}
                                t={t}
                                controls={(
                                    <StatsPagination
                                        page={yearPage}
                                        totalPages={totalYearChartPages}
                                        onPageChange={setYearPage}
                                        themeClass={themeClass}
                                        previousLabel={t('previous')}
                                        nextLabel={t('next')}
                                    />
                                )}
                            />
                            <StatsBarChart
                                title={t('thoughtsPerMonth')}
                                labelHeader={t('month')}
                                points={thoughtsPerMonthPoints}
                                backgroundColor="rgba(139, 92, 246, 0.7)"
                                borderColor="rgba(139, 92, 246, 1)"
                                options={chartOptions}
                                themeClass={themeClass}
                                language={uiLanguage}
                                t={t}
                                controls={(
                                    <StatsPagination
                                        page={monthPage}
                                        totalPages={totalMonthPages}
                                        onPageChange={setMonthPage}
                                        themeClass={themeClass}
                                        previousLabel={t('previous')}
                                        nextLabel={t('next')}
                                    />
                                )}
                            />
                        </div>

                        <div className="charts-row">
                            <StatsBarChart
                                title={t('topTags')}
                                labelHeader={t('statsChartTag')}
                                points={thoughtsPerTagPoints}
                                backgroundColor={TAG_COLORS}
                                options={tagChartOptions}
                                themeClass={themeClass}
                                language={uiLanguage}
                                t={t}
                            />

                            {/* Tags per Year Breakdown */}
                            <div className={`chart-card ${themeClass}`}>
                                <div className="chart-header">
                                    <h2>{t('topTagsByYear')}</h2>
                                    <StatsPagination
                                        page={tagsYearPage}
                                        totalPages={totalTagsYearPages}
                                        onPageChange={setTagsYearPage}
                                        themeClass={themeClass}
                                        previousLabel={t('newerYears')}
                                        nextLabel={t('olderYears')}
                                    />
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
                    </>
                )}
            </div>
        </div>
    );
}

export default Stats;

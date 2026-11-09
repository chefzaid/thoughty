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
    type ChartOptions,
} from 'chart.js';
import './Stats.css';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../PageHeader/PageHeader';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import StatsActivityHeatmap from './StatsActivityHeatmap';
import StatsInsights from './StatsInsights';
import StatsPersonalityPanel from './StatsPersonalityPanel';
import StatsCorrelationGraph from './StatsCorrelationGraph';
import StatsMoodPanel from './StatsMoodPanel';
import StatsMoodTags from './StatsMoodTags';
import StatsGoalPanel from './StatsGoalPanel';
import StatsPagination from './StatsPagination';
import StatsBarChart, { type StatsChartPoint } from './StatsBarChart';
import StatsSummaryCards from './StatsSummaryCards';
import StatsWritingTimes from './StatsWritingTimes';
import StatsRecords from './StatsRecords';
import StatsTopWords from './StatsTopWords';
import StatsTagsByYear, { type YearTagData } from './StatsTagsByYear';
import { EMPTY_STATS, type StatsData } from './emptyStats';
import QuietModeNote from '../QuietMode/QuietModeNote';
import { useQuietMode } from '../QuietMode/quietMode';
import { monthName } from '../../utils/calendarNames';
import { writersToday } from '../../utils/entryDate';
import { resolveLanguage } from '../../utils/language';
import { browserTimeZone } from '../../utils/timeZone';

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
    /** Opens the journal filtered to one tag, for the tags beside the moods. */
    readonly onOpenJournalTag?: (tag: string) => void;
    /** Opens the journal searched for one word, for the words used most. */
    readonly onSearchJournal?: (word: string) => void;
    /** Opens one entry through its permalink, for the personal records. */
    readonly onOpenEntry?: (entryId: number) => void;
    readonly onManageDiaries?: () => void;
    readonly tagMetadata?: TagMetadataMap;
    readonly language?: string;
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

function Stats({ theme, t, diaryId, onOpenJournalDay, onOpenJournalTag, onSearchJournal, onOpenEntry, onManageDiaries, tagMetadata, language }: StatsProps) {
    const { authFetch } = useAuth();
    // Quiet mode keeps the readings of the journal (insights, moods, personality, links) and leaves out its counts and goals
    const quiet = useQuietMode();
    // The writing times are read in the writer's own time zone
    const timeZone = useMemo(() => browserTimeZone(), []);
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
            params.append('today', writersToday());
            params.append('timeZone', timeZone);
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
    }, [authFetch, diaryId, timeZone]);

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
                <div className="stats-error">
                    <p>{t(error ?? 'statsLoadError')}</p>
                    <button type="button" onClick={fetchStats}>{t('retry')}</button>
                </div>
            </div>
        );
    }

    const hasEntries = stats.totalThoughts > 0;
    const moods = stats.moods ?? EMPTY_STATS.moods;

    return (
        <div className={`stats-container ${themeClass}`}>
            {header}

            {quiet ? <QuietModeNote theme={themeClass} t={t} /> : (
                <StatsSummaryCards stats={stats} yearsActive={allYearLabels.length} themeClass={themeClass} t={t} />
            )}

            {/*
              * The owner's order: the goal, the days, the counts by year and month, the tags, the
              * records, the connections, the words; then what AI reads, last. When you write follows
              * the counts it breaks down, and the recorded moods and the tags beside them follow the
              * top tags, before the records.
              */}
            <div className="charts-grid">
                {!quiet && (
                    <StatsGoalPanel
                        goals={goals}
                        diaryId={diaryId}
                        themeClass={themeClass}
                        language={uiLanguage}
                        t={t}
                        onManageDiaries={onManageDiaries}
                    />
                )}

                {!quiet && (
                    <StatsActivityHeatmap
                        thoughtsPerDay={thoughtsPerDay}
                        goal={diaryGoal}
                        themeClass={themeClass}
                        language={uiLanguage}
                        t={t}
                        onOpenJournalDay={onOpenJournalDay}
                    />
                )}

                {!quiet && hasEntries && (
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
                )}

                {/* Quiet mode keeps the rhythm of writing, which measures when rather than how much, without its counts */}
                <StatsWritingTimes
                    writingTimes={stats.writingTimes ?? EMPTY_STATS.writingTimes}
                    timeZone={timeZone}
                    themeClass={themeClass}
                    language={uiLanguage}
                    t={t}
                />

                {!quiet && hasEntries && (
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
                        <StatsTagsByYear
                            rows={tagsPerYearData}
                            page={tagsYearPage}
                            totalPages={totalTagsYearPages}
                            onPageChange={setTagsYearPage}
                            theme={theme}
                            themeClass={themeClass}
                            tagMetadata={tagMetadata}
                            t={t}
                        />
                    </div>
                )}

                {hasEntries && (
                    <>
                        <StatsMoodPanel moods={moods} themeClass={themeClass} language={uiLanguage} t={t} />
                        <StatsMoodTags
                            moods={moods}
                            theme={theme}
                            themeClass={themeClass}
                            language={uiLanguage}
                            tagMetadata={tagMetadata}
                            t={t}
                            onOpenJournalTag={onOpenJournalTag}
                        />
                    </>
                )}

                {/* Quiet mode keeps the records that say when, not how much */}
                <StatsRecords
                    records={stats.records ?? EMPTY_STATS.records}
                    themeClass={themeClass}
                    language={uiLanguage}
                    t={t}
                    onOpenEntry={onOpenEntry}
                    onOpenJournalDay={onOpenJournalDay}
                />

                {hasEntries && (
                    <StatsCorrelationGraph
                        correlations={stats.correlations ?? EMPTY_STATS.correlations}
                        themeClass={themeClass}
                        language={uiLanguage}
                        t={t}
                        onOpenJournalDay={onOpenJournalDay}
                    />
                )}

                {/* A server from before the words used most sends none */}
                {stats.topWords && (
                    <StatsTopWords topWords={stats.topWords} themeClass={themeClass} language={uiLanguage} t={t} onSearchJournal={onSearchJournal} />
                )}

                {/* AI readings last: tone, mood and subjects, then the writing tendencies */}
                {hasEntries && (
                    <>
                        <StatsInsights
                            themeClass={themeClass}
                            toneMoodAnalysis={stats.toneMoodAnalysis}
                            subjectAnalysis={stats.subjectAnalysis}
                            t={t}
                        />
                        <StatsPersonalityPanel themeClass={themeClass} diaryId={diaryId} t={t} />
                    </>
                )}
            </div>
        </div>
    );
}

export default Stats;

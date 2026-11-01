import type { components } from '../../generated/openapi';

type StatsData = components['schemas']['StatsResponseDto'];

interface StatsSummaryCardsProps {
    readonly stats: StatsData;
    /** The years with entries. */
    readonly yearsActive: number;
    readonly themeClass: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** The journal in six numbers: entries, tags, years, entries a year, words and reading time an entry. */
function StatsSummaryCards({ stats, yearsActive, themeClass, t }: StatsSummaryCardsProps) {
    const cards: Array<{ labelKey: string; value: string | number }> = [
        { labelKey: 'totalEntries', value: stats.totalThoughts },
        { labelKey: 'uniqueTags', value: stats.uniqueTagsCount },
        { labelKey: 'yearsActive', value: yearsActive },
        { labelKey: 'avgPerYear', value: stats.totalThoughts && yearsActive ? Math.round(stats.totalThoughts / yearsActive) : 0 },
        { labelKey: 'avgWordsPerEntry', value: stats.averageWordsPerEntry },
        {
            labelKey: 'avgReadingTime',
            value: stats.averageReadingTimeMinutes > 0 ? `${stats.averageReadingTimeMinutes} min` : '<1 min',
        },
    ];

    return (
        <div className="stats-summary">
            {cards.map(({ labelKey, value }) => (
                <div key={labelKey} className={`stat-card ${themeClass}`}>
                    <div className="stat-value">{value}</div>
                    <div className="stat-label">{t(labelKey)}</div>
                </div>
            ))}
        </div>
    );
}

export default StatsSummaryCards;

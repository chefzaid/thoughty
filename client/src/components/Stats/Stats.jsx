import React, { useState, useEffect } from 'react';
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

function Stats({ theme, t }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Period selection states
    const [monthsToShow, setMonthsToShow] = useState(12);
    const [tagsYearPage, setTagsYearPage] = useState(0);
    const tagsYearsPerPage = 5;

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/stats');
            if (!response.ok) throw new Error('Failed to fetch stats');
            const data = await response.json();
            setStats(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching stats:', err);
            setError('Failed to load statistics');
        } finally {
            setLoading(false);
        }
    };

    const themeClass = theme === 'light' ? 'light' : 'dark';
    const textColor = theme === 'light' ? '#374151' : '#e5e7eb';
    const gridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    const chartOptions = {
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
    };

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

    if (error) {
        return (
            <div className="stats-container">
                <div className="stats-error">
                    <p>{error}</p>
                    <button onClick={fetchStats}>Retry</button>
                </div>
            </div>
        );
    }

    // Prepare chart data
    const yearLabels = Object.keys(stats.thoughtsPerYear).sort();
    const yearData = yearLabels.map(year => stats.thoughtsPerYear[year]);

    const thoughtsPerYearChart = {
        labels: yearLabels,
        datasets: [
            {
                data: yearData,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
                borderRadius: 6,
            },
        ],
    };

    // Monthly data - configurable period
    const allMonthLabels = Object.keys(stats.thoughtsPerMonth).sort();
    const monthLabels = allMonthLabels.slice(-monthsToShow);
    const monthData = monthLabels.map(month => stats.thoughtsPerMonth[month]);

    const thoughtsPerMonthChart = {
        labels: monthLabels.map(m => {
            const [year, month] = m.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[parseInt(month) - 1]} ${year}`;
        }),
        datasets: [
            {
                data: monthData,
                backgroundColor: 'rgba(139, 92, 246, 0.7)',
                borderColor: 'rgba(139, 92, 246, 1)',
                borderWidth: 1,
                borderRadius: 6,
            },
        ],
    };

    // Top tags chart
    const tagEntries = Object.entries(stats.thoughtsPerTag).slice(0, 10);
    const tagLabels = tagEntries.map(([tag]) => tag);
    const tagData = tagEntries.map(([, count]) => count);

    const thoughtsPerTagChart = {
        labels: tagLabels,
        datasets: [
            {
                data: tagData,
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

    // Tags per year breakdown - with pagination
    const allTagsPerYear = Object.entries(stats.tagsPerYear)
        .sort(([a], [b]) => b - a)
        .map(([year, tags]) => ({
            year,
            topTags: Object.entries(tags)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5),
        }));

    const totalYearPages = Math.ceil(allTagsPerYear.length / tagsYearsPerPage);
    const tagsPerYearData = allTagsPerYear.slice(
        tagsYearPage * tagsYearsPerPage,
        (tagsYearPage + 1) * tagsYearsPerPage
    );

    // Month period options
    const monthPeriodOptions = [
        { value: 6, label: '6 months' },
        { value: 12, label: '12 months' },
        { value: 24, label: '24 months' },
        { value: 36, label: '3 years' },
        { value: allMonthLabels.length, label: 'All time' },
    ];

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
                    <div className="stat-value">{yearLabels.length}</div>
                    <div className="stat-label">{t('yearsActive')}</div>
                </div>
                <div className={`stat-card ${themeClass}`}>
                    <div className="stat-value">
                        {stats.totalThoughts && yearLabels.length
                            ? Math.round(stats.totalThoughts / yearLabels.length)
                            : 0}
                    </div>
                    <div className="stat-label">{t('avgPerYear')}</div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="charts-grid">
                {/* Thoughts per Year - with horizontal scroll */}
                <div className={`chart-card ${themeClass}`}>
                    <h3>{t('thoughtsPerYear')}</h3>
                    <div className="chart-wrapper chart-scrollable">
                        <div style={{ minWidth: yearLabels.length > 8 ? `${yearLabels.length * 60}px` : '100%', height: '100%' }}>
                            <Bar data={thoughtsPerYearChart} options={chartOptions} />
                        </div>
                    </div>
                </div>

                {/* Thoughts per Month - with period selector */}
                <div className={`chart-card ${themeClass}`}>
                    <div className="chart-header">
                        <h3>{t('thoughtsPerMonth')}</h3>
                        <select
                            className={`period-select ${themeClass}`}
                            value={monthsToShow}
                            onChange={(e) => setMonthsToShow(Number(e.target.value))}
                        >
                            {monthPeriodOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="chart-wrapper chart-scrollable">
                        <div style={{ minWidth: monthLabels.length > 12 ? `${monthLabels.length * 50}px` : '100%', height: '100%' }}>
                            <Bar data={thoughtsPerMonthChart} options={chartOptions} />
                        </div>
                    </div>
                </div>

                <div className={`chart-card ${themeClass}`}>
                    <h3>{t('topTags')}</h3>
                    <div className="chart-wrapper">
                        <Bar
                            data={thoughtsPerTagChart}
                            options={{
                                ...chartOptions,
                                indexAxis: 'y',
                            }}
                        />
                    </div>
                </div>

                {/* Tags per Year Breakdown - with pagination */}
                <div className={`chart-card ${themeClass}`}>
                    <div className="chart-header">
                        <h3>{t('topTagsByYear')}</h3>
                        {totalYearPages > 1 && (
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
                                    {tagsYearPage + 1} / {totalYearPages}
                                </span>
                                <button
                                    className={`pagination-btn ${themeClass}`}
                                    onClick={() => setTagsYearPage(p => Math.min(totalYearPages - 1, p + 1))}
                                    disabled={tagsYearPage === totalYearPages - 1}
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
                                                <span key={tag} className="tag-badge" style={{ marginRight: '0.5rem' }}>
                                                    {tag} ({count})
                                                </span>
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
    );
}

export default Stats;

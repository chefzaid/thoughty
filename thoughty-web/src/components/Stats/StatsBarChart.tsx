import { useId, useMemo, useState, type ReactNode } from 'react';
import type { ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';

import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

/** One bar: what it counts and how many entries. */
export interface StatsChartPoint {
    readonly label: string;
    readonly value: number;
}

interface StatsBarChartProps {
    readonly title: string;
    /** The heading of the data table's first column (Year, Month, Tag). */
    readonly labelHeader: string;
    readonly points: readonly StatsChartPoint[];
    readonly backgroundColor: string | readonly string[];
    readonly borderColor?: string;
    readonly options: ChartOptions<'bar'>;
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly t: TranslationFunction;
    /** Page buttons, shown before the table switch. */
    readonly controls?: ReactNode;
}

/**
 * A bar chart card. The canvas is an image named by the card's title and described by its values, and a
 * switch shows the same values as a table, for readers who cannot see the bars or prefer numbers.
 */
export default function StatsBarChart({
    title,
    labelHeader,
    points,
    backgroundColor,
    borderColor,
    options,
    themeClass,
    language,
    t,
    controls,
}: StatsBarChartProps) {
    const id = useId();
    const titleId = `${id}-title`;
    const summaryId = `${id}-summary`;
    const [showTable, setShowTable] = useState(false);
    const valueLabels = points.map(({ label, value }) => pluralPhrase(t, 'statsChartValue', value, language, { label }));
    const data = useMemo(() => ({
        labels: points.map(({ label }) => label),
        datasets: [{
            data: points.map(({ value }) => value),
            backgroundColor: [backgroundColor].flat(),
            borderColor,
            borderWidth: borderColor ? 1 : 0,
            borderRadius: 6,
        }],
    }), [backgroundColor, borderColor, points]);

    return (
        <div className={`chart-card ${themeClass}`}>
            <div className="chart-header">
                <h2 id={titleId}>{title}</h2>
                <div className="chart-header-actions">
                    {controls}
                    <button
                        type="button"
                        className={`chart-view-toggle ${themeClass}`}
                        aria-pressed={showTable}
                        onClick={() => setShowTable((shown) => !shown)}
                    >
                        {t('statsChartTableToggle')}
                    </button>
                </div>
            </div>
            {showTable ? (
                <table className="tag-table chart-data-table" aria-labelledby={titleId}>
                    <thead>
                        <tr>
                            <th scope="col">{labelHeader}</th>
                            <th scope="col">{t('entries')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {points.map(({ label, value }) => (
                            <tr key={label}>
                                <th scope="row">{label}</th>
                                <td>{value.toLocaleString(language)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="chart-wrapper">
                    <Bar data={data} options={options} aria-labelledby={titleId} aria-describedby={summaryId} />
                    <p id={summaryId} className="sr-only">{valueLabels.join('; ')}</p>
                </div>
            )}
        </div>
    );
}

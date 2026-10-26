import { useMemo, useState } from 'react';
import type { components } from '../../generated/openapi';
import { monthName, weekdayName } from '../../utils/calendarNames';
import { feelingLabel, moodEmoji, moodLabelKey, nearestMoodLevel, MOOD_LEVELS } from '../../utils/entryMood';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

type StatsMood = components['schemas']['StatsMoodDto'];
type MoodMonth = StatsMood['months'][number];

interface StatsMoodPanelProps {
    readonly moods: StatsMood;
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

const MONTHS_PER_PAGE = 12;
const WIDTH = 640;
const HEIGHT = 200;
const PLOT_TOP = 14;
const PLOT_BOTTOM = HEIGHT - 14;

function monthLabel(month: string, language: Language): string {
    return `${monthName(Number(month.slice(5, 7)), language)} ${month.slice(0, 4)}`;
}

function monthNumber(month: string): number {
    return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
}

function yFor(average: number): number {
    return PLOT_BOTTOM - ((average - 1) / 4) * (PLOT_BOTTOM - PLOT_TOP);
}

/** Runs of consecutive months, so a month without a recorded mood leaves a gap in the line. */
function lineRuns(points: Array<{ month: string; x: number; y: number }>): string[] {
    const runs: Array<Array<{ x: number; y: number }>> = [];
    let previous = Number.NaN;
    for (const point of points) {
        const current = monthNumber(point.month);
        if (runs.length === 0 || current !== previous + 1) {
            runs.push([]);
        }
        runs.at(-1)?.push(point);
        previous = current;
    }
    return runs.filter((run) => run.length > 1).map((run) => run.map((point) => `${point.x},${point.y}`).join(' '));
}

function formatAverage(value: number, language: Language): string {
    return value.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function MoodOverTime({ months, language, t, themeClass }: Readonly<{ months: MoodMonth[]; language: Language; t: StatsMoodPanelProps['t']; themeClass: 'light' | 'dark' }>) {
    const totalPages = Math.max(1, Math.ceil(months.length / MONTHS_PER_PAGE));
    // The latest months come first; earlier pages go back in time
    const [pageFromEnd, setPageFromEnd] = useState(0);
    const end = months.length - pageFromEnd * MONTHS_PER_PAGE;
    const shown = months.slice(Math.max(0, end - MONTHS_PER_PAGE), end);
    const step = WIDTH / Math.max(1, shown.length);
    const points = shown.map((month, index) => ({ ...month, x: step * index + step / 2, y: yFor(month.average) }));
    const describe = (month: MoodMonth) => pluralPhrase(t, 'statsMoodMonthPoint', month.entries, language, {
        month: monthLabel(month.month, language),
        average: formatAverage(month.average, language),
        label: t(moodLabelKey(nearestMoodLevel(month.average))),
    });

    return (
        <div className="mood-panel-section">
            <div className="chart-header">
                <h4>{t('statsMoodOverTime')}</h4>
                {totalPages > 1 && (
                    <div className="pagination-controls">
                        <button
                            type="button"
                            className={`pagination-btn ${themeClass}`}
                            onClick={() => setPageFromEnd((page) => Math.min(totalPages - 1, page + 1))}
                            disabled={pageFromEnd === totalPages - 1}
                            title={t('statsMoodEarlier')}
                            aria-label={t('statsMoodEarlier')}
                        >
                            ←
                        </button>
                        <span className="pagination-info">{totalPages - pageFromEnd} / {totalPages}</span>
                        <button
                            type="button"
                            className={`pagination-btn ${themeClass}`}
                            onClick={() => setPageFromEnd((page) => Math.max(0, page - 1))}
                            disabled={pageFromEnd === 0}
                            title={t('statsMoodLater')}
                            aria-label={t('statsMoodLater')}
                        >
                            →
                        </button>
                    </div>
                )}
            </div>
            <div className="mood-line-chart">
                <ol className="mood-line-scale" aria-hidden="true">
                    {[...MOOD_LEVELS].reverse().map((level) => (
                        <li key={level} style={{ top: `${(yFor(level) / HEIGHT) * 100}%` }}>{t(moodLabelKey(level))}</li>
                    ))}
                </ol>
                <div
                    className="mood-line-plot"
                    role="img"
                    aria-label={t('statsMoodChartLabel', { months: shown.map(describe).join('; ') })}
                >
                    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                        {MOOD_LEVELS.map((level) => (
                            <line
                                key={level}
                                x1={0}
                                x2={WIDTH}
                                y1={yFor(level)}
                                y2={yFor(level)}
                                className={`mood-gridline${level === 3 ? ' mood-gridline-mid' : ''}`}
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}
                        {lineRuns(points).map((run) => (
                            <polyline key={run} points={run} className="mood-line" vectorEffect="non-scaling-stroke" />
                        ))}
                    </svg>
                    {/* Dots are HTML so they stay round however the plot stretches; the title is the hover tooltip */}
                    {points.map((point) => (
                        <span
                            key={point.month}
                            className="mood-point"
                            style={{ left: `${(point.x / WIDTH) * 100}%`, top: `${(point.y / HEIGHT) * 100}%` }}
                            title={describe(point)}
                        />
                    ))}
                </div>
                <ol className="mood-line-months" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${Math.max(1, shown.length)}, minmax(0, 1fr))` }}>
                    {shown.map((month, index) => (
                        <li key={month.month}>
                            <span>{monthName(Number(month.month.slice(5, 7)), language, 'short')}</span>
                            {/* The year only where it starts or changes, so twelve months fit a phone */}
                            {(index === 0 || month.month.endsWith('-01')) && <span className="mood-line-year">{month.month.slice(0, 4)}</span>}
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}

/**
 * The moods writers chose themselves, summed up without AI: the average and how many entries
 * have one, the average by month, by weekday, and the feeling words named most.
 */
function StatsMoodPanel({ moods, themeClass, language, t }: StatsMoodPanelProps) {
    const maxFeeling = useMemo(() => Math.max(1, ...moods.topFeelings.map((feeling) => feeling.count)), [moods.topFeelings]);
    const hasMoods = moods.recordedEntries > 0;
    const hasFeelings = moods.topFeelings.length > 0;

    return (
        <section className={`chart-card mood-card ${themeClass}`} aria-labelledby="stats-mood-heading">
            <div className="chart-header tone-mood-header">
                <div>
                    <h3 id="stats-mood-heading">{t('statsMoodTitle')}</h3>
                    <p className="tone-mood-description">{t('statsMoodIntro')}</p>
                </div>
            </div>

            {!hasMoods && !hasFeelings ? (
                <p className="tone-mood-unavailable">{t('statsMoodEmpty')}</p>
            ) : (
                <>
                    {hasMoods && moods.averageMood !== null && (
                        <div className="tone-mood-highlights">
                            <div className={`tone-mood-highlight ${themeClass}`}>
                                <span className="tone-mood-highlight-label">{t('statsMoodAverage')}</span>
                                <strong>
                                    <span aria-hidden="true">{moodEmoji(nearestMoodLevel(moods.averageMood))} </span>
                                    {t('moodOutOfFive', { value: formatAverage(moods.averageMood, language) })}
                                    {' · '}
                                    {t(moodLabelKey(nearestMoodLevel(moods.averageMood)))}
                                </strong>
                            </div>
                            <div className={`tone-mood-highlight ${themeClass}`}>
                                <span className="tone-mood-highlight-label">{t('statsMoodRecorded')}</span>
                                <strong>{moods.recordedEntries.toLocaleString(language)}</strong>
                            </div>
                        </div>
                    )}

                    {hasMoods && <MoodOverTime months={moods.months} language={language} t={t} themeClass={themeClass} />}

                    <div className="tone-mood-breakdowns">
                        {hasMoods && (
                            <div className="tone-mood-breakdown">
                                <h4>{t('statsMoodByWeekday')}</h4>
                                <ul className="tone-mood-list">
                                    {moods.weekdays.map((weekday, index) => {
                                        // The list is Monday first; weekdayName counts from Sunday
                                        const name = weekdayName((index + 1) % 7, language);
                                        return (
                                            <li key={name} className="tone-mood-list-item">
                                                <div className="tone-mood-list-labels">
                                                    <span>{name}</span>
                                                    <span aria-hidden="true">{weekday.average === null ? '–' : formatAverage(weekday.average, language)}</span>
                                                </div>
                                                <span className="sr-only">
                                                    {weekday.average === null
                                                        ? t('statsMoodWeekdayEmpty', { weekday: name })
                                                        : pluralPhrase(t, 'statsMoodWeekdayRow', weekday.entries, language, { weekday: name, average: formatAverage(weekday.average, language) })}
                                                </span>
                                                <span className="tone-mood-bar-track" aria-hidden="true">
                                                    <span className="tone-mood-bar-fill recorded-mood" style={{ width: `${((weekday.average ?? 0) / 5) * 100}%` }} />
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                        <div className="tone-mood-breakdown">
                            <h4>{t('statsTopFeelings')}</h4>
                            {hasFeelings ? (
                                <ul className="tone-mood-list">
                                    {moods.topFeelings.map((feeling) => {
                                        const label = feelingLabel(feeling.feeling, t);
                                        return (
                                            <li key={feeling.feeling} className="tone-mood-list-item">
                                                <div className="tone-mood-list-labels">
                                                    <span>{label}</span>
                                                    <span aria-hidden="true">{feeling.count.toLocaleString(language)}</span>
                                                </div>
                                                <span className="sr-only">{pluralPhrase(t, 'statsFeelingRow', feeling.count, language, { feeling: label })}</span>
                                                <span className="tone-mood-bar-track" aria-hidden="true">
                                                    <span className="tone-mood-bar-fill recorded-feeling" style={{ width: `${(feeling.count / maxFeeling) * 100}%` }} />
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="tone-mood-unavailable">{t('statsTopFeelingsEmpty')}</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}

export default StatsMoodPanel;

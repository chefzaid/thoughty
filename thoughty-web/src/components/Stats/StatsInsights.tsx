import type { components } from '../../generated/openapi';
import './StatsInsights.css';

type StatsData = components['schemas']['StatsResponseDto'];
type ToneMoodAnalysis = NonNullable<StatsData['toneMoodAnalysis']>;
type SubjectAnalysis = NonNullable<StatsData['subjectAnalysis']>;

interface StatsInsightsProps {
    readonly themeClass: 'light' | 'dark';
    readonly toneMoodAnalysis?: ToneMoodAnalysis | null;
    readonly subjectAnalysis?: SubjectAnalysis | null;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

function formatInsightLabel(label: string): string {
    return label
        .replaceAll(/[_-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function InsightBreakdown({
    breakdown,
    analyzedEntries,
    variant,
}: Readonly<{
    breakdown: Record<string, number>;
    analyzedEntries: number;
    variant: 'mood' | 'tone' | 'subject';
}>) {
    const entries = Object.entries(breakdown).sort(([, left], [, right]) => right - left);
    const denominator = Math.max(1, analyzedEntries);

    return (
        <ul className={variant === 'subject' ? 'tone-mood-list subject-insights-list' : 'tone-mood-list'}>
            {entries.map(([label, count]) => {
                const width = Math.max(8, Math.min(100, Math.round((count / denominator) * 100)));

                return (
                    <li key={label} className="tone-mood-list-item">
                        <div className="tone-mood-list-labels">
                            <span>{formatInsightLabel(label)}</span>
                            <span>{count}</span>
                        </div>
                        <div className="tone-mood-bar-track" aria-hidden="true">
                            <span className={`tone-mood-bar-fill ${variant}`} style={{ width: `${width}%` }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function ToneMoodCard({
    analysis,
    themeClass,
    t,
}: Readonly<{
    analysis?: ToneMoodAnalysis | null;
    themeClass: 'light' | 'dark';
    t: StatsInsightsProps['t'];
}>) {
    return (
        <section className={`chart-card tone-mood-card ${themeClass}`} aria-labelledby="tone-mood-heading">
            <div className="chart-header tone-mood-header">
                <div>
                    <h3 id="tone-mood-heading">{t('toneMoodInsights')}</h3>
                    <p className="tone-mood-description">{t('toneMoodInsightsDescription')}</p>
                </div>
                {analysis && (
                    <div className={`tone-mood-sample ${themeClass}`}>
                        <span>{t('analyzedEntries')}</span>
                        <strong>{analysis.analyzedEntries}</strong>
                    </div>
                )}
            </div>

            {analysis ? (
                <>
                    <div className="tone-mood-highlights">
                        <div className={`tone-mood-highlight ${themeClass}`}>
                            <span className="tone-mood-highlight-label">{t('dominantMood')}</span>
                            <strong>{formatInsightLabel(analysis.dominantMood)}</strong>
                        </div>
                        <div className={`tone-mood-highlight ${themeClass}`}>
                            <span className="tone-mood-highlight-label">{t('dominantTone')}</span>
                            <strong>{formatInsightLabel(analysis.dominantTone)}</strong>
                        </div>
                    </div>
                    <p className="tone-mood-summary">{analysis.summary}</p>
                    <div className="tone-mood-breakdowns">
                        <div className="tone-mood-breakdown">
                            <h4>{t('moodMix')}</h4>
                            <InsightBreakdown
                                breakdown={analysis.moodBreakdown}
                                analyzedEntries={analysis.analyzedEntries}
                                variant="mood"
                            />
                        </div>
                        <div className="tone-mood-breakdown">
                            <h4>{t('toneMix')}</h4>
                            <InsightBreakdown
                                breakdown={analysis.toneBreakdown}
                                analyzedEntries={analysis.analyzedEntries}
                                variant="tone"
                            />
                        </div>
                    </div>
                </>
            ) : (
                <p className="tone-mood-unavailable">{t('toneMoodUnavailable')}</p>
            )}
        </section>
    );
}

function SubjectCard({
    analysis,
    themeClass,
    t,
}: Readonly<{
    analysis?: SubjectAnalysis | null;
    themeClass: 'light' | 'dark';
    t: StatsInsightsProps['t'];
}>) {
    return (
        <section className={`chart-card subject-insights-card ${themeClass}`} aria-labelledby="subject-insights-heading">
            <div className="chart-header tone-mood-header">
                <div>
                    <h3 id="subject-insights-heading">{t('subjectsDiscussed')}</h3>
                    <p className="tone-mood-description">{t('subjectsDiscussedDescription')}</p>
                </div>
                {analysis && (
                    <div className={`tone-mood-sample subject-insights-sample ${themeClass}`}>
                        <span>{t('analyzedEntries')}</span>
                        <strong>{analysis.analyzedEntries}</strong>
                    </div>
                )}
            </div>

            {analysis ? (
                <>
                    {analysis.summary && <p className="tone-mood-summary">{analysis.summary}</p>}
                    <InsightBreakdown
                        breakdown={analysis.subjectBreakdown}
                        analyzedEntries={analysis.analyzedEntries}
                        variant="subject"
                    />
                </>
            ) : (
                <p className="tone-mood-unavailable">{t('subjectsDiscussedUnavailable')}</p>
            )}
        </section>
    );
}

export default function StatsInsights({
    themeClass,
    toneMoodAnalysis,
    subjectAnalysis,
    t,
}: Readonly<StatsInsightsProps>) {
    return (
        <>
            <ToneMoodCard analysis={toneMoodAnalysis} themeClass={themeClass} t={t} />
            <SubjectCard analysis={subjectAnalysis} themeClass={themeClass} t={t} />
        </>
    );
}

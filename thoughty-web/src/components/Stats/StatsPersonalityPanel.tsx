import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { components } from '../../generated/openapi';
import './StatsPersonalityPanel.css';

type PersonalityRequest =
    components['schemas']['PersonalityAnalysisRequestDto'];
type PersonalityAnalysis = components['schemas']['PersonalityAnalysisDto'];

interface StatsPersonalityPanelProps {
    readonly themeClass: 'light' | 'dark';
    readonly diaryId?: number | null;
    readonly t: (
        key: string,
        params?: Record<string, string | number>
    ) => string;
}

export default function StatsPersonalityPanel({
    themeClass,
    diaryId,
    t,
}: Readonly<StatsPersonalityPanelProps>) {
    const { authFetch } = useAuth();
    const requestId = useRef(0);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [analysis, setAnalysis] = useState<PersonalityAnalysis | null>(null);
    const [hasRequested, setHasRequested] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        requestId.current += 1;
        setAnalysis(null);
        setHasRequested(false);
        setLoading(false);
        setError(null);

        return () => {
            requestId.current += 1;
        };
    }, [diaryId]);

    const analyze = async (): Promise<void> => {
        if (fromDate && toDate && fromDate > toDate) {
            setError(t('personalityInvalidDateRange'));
            return;
        }

        const currentRequest = ++requestId.current;
        const payload: PersonalityRequest = {};
        if (diaryId) payload.diaryId = diaryId;
        if (fromDate) payload.fromDate = fromDate;
        if (toDate) payload.toDate = toDate;

        setLoading(true);
        setError(null);
        setHasRequested(true);

        try {
            const response = await authFetch(
                '/api/stats/personality-analysis',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            );
            if (!response.ok)
                throw new Error('Personality analysis request failed');

            const data =
                (await response.json()) as components['schemas']['PersonalityAnalysisResponseDto'];
            if (currentRequest === requestId.current)
                setAnalysis(data.analysis);
        } catch (requestError) {
            console.error('Error analyzing writing tendencies:', requestError);
            if (currentRequest === requestId.current) {
                setAnalysis(null);
                setError(t('personalityAnalysisError'));
            }
        } finally {
            if (currentRequest === requestId.current) setLoading(false);
        }
    };

    return (
        <section
            className={`chart-card personality-panel ${themeClass}`}
            aria-labelledby="personality-insights-heading"
        >
            <div className="personality-panel-header">
                <h3 id="personality-insights-heading">
                    {t('personalityInsights')}
                </h3>
                <div className="personality-controls">
                    <label>
                        <span>{t('personalityFromDate')}</span>
                        <input
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(event) =>
                                setFromDate(event.target.value)
                            }
                        />
                    </label>
                    <label>
                        <span>{t('personalityToDate')}</span>
                        <input
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(event) => setToDate(event.target.value)}
                        />
                    </label>
                    <button
                        type="button"
                        className="personality-analyze-button"
                        onClick={analyze}
                        disabled={loading}
                    >
                        <i
                            className={`codicon ${loading ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}`}
                        />
                        <span>
                            {loading
                                ? t('analyzingPersonality')
                                : t('analyzePersonality')}
                        </span>
                    </button>
                </div>
            </div>

            {error && (
                <p className="personality-message error" role="alert">
                    {error}
                </p>
            )}

            {analysis && (
                <div className="personality-results" aria-live="polite">
                    <p className="personality-summary">{analysis.summary}</p>
                    <dl className="personality-metrics">
                        <div>
                            <dt>{t('analyzedEntries')}</dt>
                            <dd>{analysis.analyzedEntries}</dd>
                        </div>
                        <div>
                            <dt>{t('personalityWordsAnalyzed')}</dt>
                            <dd>{analysis.analyzedWords.toLocaleString()}</dd>
                        </div>
                        <div>
                            <dt>{t('personalityDateRange')}</dt>
                            <dd>
                                {analysis.fromDate} - {analysis.toDate}
                            </dd>
                        </div>
                    </dl>
                    <ul className="personality-traits">
                        {analysis.traits.map((trait) => (
                            <li key={trait.label}>
                                <div className="personality-trait-heading">
                                    <strong>{trait.label}</strong>
                                    <span>{trait.score}</span>
                                </div>
                                <div
                                    className="personality-score-track"
                                    aria-hidden="true"
                                >
                                    <span
                                        style={{ width: `${trait.score}%` }}
                                    />
                                </div>
                                <p>{trait.evidence}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {hasRequested && !loading && !analysis && !error && (
                <p className="personality-message">
                    {t('personalityUnavailable')}
                </p>
            )}

            <div className="personality-notes">
                <p>
                    <i className="codicon codicon-lock" aria-hidden="true" />
                    {t('personalityPrivacy')}
                </p>
                <p>
                    <i className="codicon codicon-info" aria-hidden="true" />
                    {t('personalityDisclaimer')}
                </p>
            </div>
        </section>
    );
}

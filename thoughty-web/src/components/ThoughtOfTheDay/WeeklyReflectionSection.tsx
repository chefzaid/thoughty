import { useId } from 'react';
import { useFeatureFlag } from '../FeatureFlags/featureFlags';
import FeatureOffNote from '../FeatureFlags/FeatureOffNote';
import { useDiaryAiScope } from '../DiaryAi/diaryAiScope';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import type { Language } from '../../utils/translations';
import { useWeeklyReflection } from './useWeeklyReflection';
import './WeeklyReflectionSection.css';

interface WeeklyReflectionSectionProps {
    readonly diaryId: number | null;
    readonly language: Language;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * **Your week** in Highlights: on request, AI reads the past seven days of entries for the themes that came
 * back, a few words on how the week went and one question for the week ahead. Shown only while AI is on and
 * available to the writer; the reflection stays until they ask again. For a diary with AI off it says so
 * instead, and for all diaries it says those with AI off are left out.
 */
export default function WeeklyReflectionSection({ diaryId, language, theme, t }: WeeklyReflectionSectionProps) {
    const titleId = useId();
    const aiOn = useFeatureFlag('ai');
    const { aiOff, aiOffLeftOut } = useDiaryAiScope(diaryId);
    const { week, reading, error, reflect } = useWeeklyReflection(diaryId, aiOn);

    if (!aiOn || !week?.aiAvailable) {
        return null;
    }

    const title = (
        <h3 id={titleId} className="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
            {t('weeklyReflectionTitle')}
        </h3>
    );

    if (aiOff) {
        return (
            <section className="highlight-section weekly-reflection" aria-labelledby={titleId}>
                {title}
                <FeatureOffNote message="diaryAiOffNotice" theme={theme} t={t} />
            </section>
        );
    }

    const reflection = week.reflection;
    const actionKey = reflection ? 'weeklyReflectionAgain' : 'weeklyReflectionAction';
    const range = t('weeklyReflectionRange', {
        start: formatEntryDay(reflection?.weekStart ?? week.weekStart, language),
        end: formatEntryDay(reflection?.weekEnd ?? week.weekEnd, language),
    });

    return (
        <section className="highlight-section weekly-reflection" aria-labelledby={titleId} aria-busy={reading}>
            {title}
            <div className="highlight-card weekly-reflection-card">
                <p className="weekly-reflection-range">{range}</p>
                {reflection ? (
                    <>
                        <p className="weekly-reflection-label">{t('weeklyReflectionThemes')}</p>
                        <ul className="weekly-reflection-themes">
                            {reflection.themes.map((theme) => (
                                <li key={theme} className="privacy-text">{theme}</li>
                            ))}
                        </ul>
                        <p className="weekly-reflection-summary privacy-text">{reflection.summary}</p>
                        <p className="weekly-reflection-label">{t('weeklyReflectionQuestion')}</p>
                        <blockquote className="weekly-reflection-question privacy-text">{reflection.question}</blockquote>
                    </>
                ) : (
                    <p className="weekly-reflection-note">{t(week.entries > 0 ? 'weeklyReflectionIntro' : 'weeklyReflectionEmpty')}</p>
                )}
                {week.entries > 0 && (
                    <>
                        <p className="weekly-reflection-note">
                            {aiOffLeftOut ? `${t('weeklyReflectionPrivacy')} ${t('diaryAiOffLeftOut')}` : t('weeklyReflectionPrivacy')}
                        </p>
                        <button
                            type="button"
                            className="weekly-reflection-action"
                            aria-disabled={reading}
                            onClick={() => void reflect()}
                        >
                            {t(reading ? 'weeklyReflectionReading' : actionKey)}
                        </button>
                    </>
                )}
                {error && <p role="alert" className="weekly-reflection-error">{t(error)}</p>}
            </div>
        </section>
    );
}

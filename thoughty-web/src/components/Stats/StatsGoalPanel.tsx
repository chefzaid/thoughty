import './StatsGoals.css';
import type { components } from '../../generated/openapi';
import { describeDiaryGoal } from '../../utils/diaryGoals';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

export type DiaryGoalProgress = components['schemas']['DiaryGoalProgressDto'];

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface StatsGoalPanelProps {
    readonly goals: DiaryGoalProgress[];
    readonly diaryId?: number | null;
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly t: Translate;
    readonly onManageDiaries?: () => void;
}

/** "2 of 3 entries this week", and whether the goal is met yet. */
function GoalProgress({ goal, language, t }: Readonly<{ goal: DiaryGoalProgress; language: Language; t: Translate }>) {
    const isWeek = goal.period === 'week';
    const progressText = pluralPhrase(t, isWeek ? 'statsGoalProgressWeek' : 'statsGoalProgressDay', goal.goalTarget, language, {
        progress: goal.progress.toLocaleString(language),
    });
    const unit = isWeek ? 'Weeks' : 'Days';

    return (
        <>
            <progress
                className="goal-progress-bar"
                value={Math.min(goal.progress, goal.goalTarget)}
                max={goal.goalTarget}
                aria-label={progressText}
            />
            <p className="goal-progress-text">
                <span>{progressText}</span>
                {goal.met && (
                    <span className="goal-met-badge">
                        <span aria-hidden="true">✓ </span>
                        {t(isWeek ? 'statsGoalMetWeek' : 'statsGoalMetDay')}
                    </span>
                )}
            </p>
            <p className="goal-streaks">
                <span>{pluralPhrase(t, `statsGoalStreak${unit}`, goal.currentStreak, language)}</span>
                <span>{pluralPhrase(t, `statsGoalBest${unit}`, goal.longestStreak, language)}</span>
            </p>
        </>
    );
}

/**
 * Writing goal progress: the selected diary's goal, or each diary's for all diaries, with a word
 * that goals are set per diary when there is none to show.
 */
export default function StatsGoalPanel({ goals, diaryId, themeClass, language, t, onManageDiaries }: StatsGoalPanelProps) {
    const goal = diaryId ? goals.find((candidate) => candidate.diaryId === diaryId) : undefined;
    const manageButton = onManageDiaries && (
        <button type="button" className={`goal-manage-btn ${themeClass}`} onClick={onManageDiaries}>
            {t('statsGoalManage')}
        </button>
    );

    let body;
    if (diaryId) {
        body = goal ? (
            <>
                <p className="goal-target">{describeDiaryGoal(t, language, goal.goalType, goal.goalTarget)}</p>
                <GoalProgress goal={goal} language={language} t={t} />
            </>
        ) : (
            <>
                <p className="goal-hint">{t('statsGoalNone')}</p>
                {manageButton}
            </>
        );
    } else if (goals.length === 0) {
        body = (
            <>
                <p className="goal-hint">{t('statsGoalPerDiary')}</p>
                {manageButton}
            </>
        );
    } else {
        body = (
            <>
                <p className="goal-hint">{t('statsGoalPickDiary')}</p>
                <ul className="goal-list">
                    {goals.map((item) => (
                        <li key={item.diaryId} className="goal-list-item">
                            <p className="goal-target">
                                <span aria-hidden="true">{item.diaryIcon} </span>
                                <strong>{item.diaryName}</strong>
                                {' · '}
                                {describeDiaryGoal(t, language, item.goalType, item.goalTarget)}
                            </p>
                            <GoalProgress goal={item} language={language} t={t} />
                        </li>
                    ))}
                </ul>
            </>
        );
    }

    return (
        <section className={`chart-card goal-card ${themeClass}`} aria-labelledby="writing-goal-heading">
            <h3 id="writing-goal-heading">{t('diaryGoal')}</h3>
            {body}
        </section>
    );
}

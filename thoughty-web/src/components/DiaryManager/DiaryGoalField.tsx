import { useId } from 'react';
import './DiaryGoalField.css';
import type { DiaryGoalType } from '../../types';
import { DIARY_GOAL_LIMITS, type DiaryGoalDraft } from '../../utils/diaryGoals';

const GOAL_TYPE_LABELS: Record<DiaryGoalType, string> = {
    entries_per_week: 'diaryGoalTypeEntriesPerWeek',
    words_per_day: 'diaryGoalTypeWordsPerDay',
};

/** The optional writing goal of a diary: no goal, entries per week or words per day, with its target. */
export default function DiaryGoalField({
    goal,
    onChange,
    t,
}: Readonly<{
    goal: DiaryGoalDraft;
    onChange: (goal: DiaryGoalDraft) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}>) {
    const id = useId();
    const limits = goal.type ? DIARY_GOAL_LIMITS[goal.type] : null;

    return (
        <div className="diary-goal-field">
            <label className="visibility-label" htmlFor={`${id}-type`}>{t('diaryGoal')}</label>
            <div className="diary-goal-inputs">
                <select
                    id={`${id}-type`}
                    className="diary-goal-select"
                    value={goal.type}
                    onChange={(event) => {
                        const type = event.target.value as DiaryGoalType | '';
                        onChange({ type, target: type ? goal.target || String(DIARY_GOAL_LIMITS[type].min) : '' });
                    }}
                >
                    <option value="">{t('diaryGoalNone')}</option>
                    {(Object.keys(GOAL_TYPE_LABELS) as DiaryGoalType[]).map((type) => (
                        <option key={type} value={type}>{t(GOAL_TYPE_LABELS[type])}</option>
                    ))}
                </select>
                {limits && (
                    <input
                        type="number"
                        inputMode="numeric"
                        className="diary-goal-target"
                        min={limits.min}
                        max={limits.max}
                        step={1}
                        value={goal.target}
                        onChange={(event) => onChange({ ...goal, target: event.target.value })}
                        aria-label={t('diaryGoalTarget')}
                    />
                )}
            </div>
        </div>
    );
}

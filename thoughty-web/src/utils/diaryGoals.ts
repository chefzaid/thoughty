import type { DiaryGoalType, TranslationFunction } from '../types';
import { pluralPhrase } from './pluralPhrase';
import type { Language } from './translations';

export const DIARY_GOAL_TYPES: readonly DiaryGoalType[] = ['entries_per_week', 'words_per_day'];

/** The bounds of each goal type, as the API holds them. */
export const DIARY_GOAL_LIMITS: Readonly<Record<DiaryGoalType, { min: number; max: number }>> = {
    entries_per_week: { min: 1, max: 50 },
    words_per_day: { min: 10, max: 10_000 },
};

/** The goal as the diary form edits it: no type for no goal, and the target as typed. */
export interface DiaryGoalDraft {
    type: DiaryGoalType | '';
    target: string;
}

export const NO_DIARY_GOAL: DiaryGoalDraft = { type: '', target: '' };

export function diaryGoalDraft(goalType?: DiaryGoalType | null, goalTarget?: number | null): DiaryGoalDraft {
    return goalType && goalTarget ? { type: goalType, target: String(goalTarget) } : NO_DIARY_GOAL;
}

export type DiaryGoalFields = { goalType: DiaryGoalType | null; goalTarget: number | null };

/** The goal fields to send, or the message to show when the target is not a whole number within bounds. */
export function readDiaryGoal(draft: DiaryGoalDraft, t: TranslationFunction, language: Language): { fields: DiaryGoalFields } | { error: string } {
    if (!draft.type) return { fields: { goalType: null, goalTarget: null } };
    const { min, max } = DIARY_GOAL_LIMITS[draft.type];
    const target = Number(draft.target.trim());
    if (!/^\d+$/.test(draft.target.trim()) || target < min || target > max) {
        return { error: t('diaryGoalTargetRange', { min: min.toLocaleString(language), max: max.toLocaleString(language) }) };
    }
    return { fields: { goalType: draft.type, goalTarget: target } };
}

/** "3 entries a week" or "500 words a day". */
export function describeDiaryGoal(t: TranslationFunction, language: Language, goalType: DiaryGoalType, goalTarget: number): string {
    const key = goalType === 'entries_per_week' ? 'diaryGoalEntriesPerWeek' : 'diaryGoalWordsPerDay';
    return pluralPhrase(t, key, goalTarget, language);
}

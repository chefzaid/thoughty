import type { TranslationFunction } from '../../types';

const GOAL_STORAGE_KEY = 'thoughty.focusModeGoal';
export const MAX_WORD_GOAL = 100_000;

/** The goal set last time, offered again; empty when there is none or storage is unavailable. */
export function readSavedGoal(): string {
    try {
        return globalThis.localStorage?.getItem(GOAL_STORAGE_KEY) ?? '';
    } catch {
        return '';
    }
}

export function saveGoal(goal: string): void {
    try {
        if (goal) {
            globalThis.localStorage?.setItem(GOAL_STORAGE_KEY, goal);
        } else {
            globalThis.localStorage?.removeItem(GOAL_STORAGE_KEY);
        }
    } catch {
        // Remembering the goal is a convenience; focus mode works without storage.
    }
}

/** A whole number of words from 1 up, or null for no goal. */
export function parseWordGoal(value: string): number | null {
    const goal = Number(value);
    return value.trim() !== '' && Number.isInteger(goal) && goal > 0 ? Math.min(goal, MAX_WORD_GOAL) : null;
}

/** "1 word", "3 words", and in French "0 mot", which counts zero as singular. */
export function wordsPhrase(t: TranslationFunction, count: number, language: string): string {
    const locale = language === 'fr' ? 'fr' : 'en';
    const form = new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other';
    return t(`focusModeWords_${form}`, { count: count.toLocaleString(locale) });
}

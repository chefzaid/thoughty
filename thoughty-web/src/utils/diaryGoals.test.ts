import { describe, expect, it } from 'vitest';
import { describeDiaryGoal, diaryGoalDraft, NO_DIARY_GOAL, readDiaryGoal } from './diaryGoals';
import { getTranslation, type Language } from './translations';

const translate = (language: Language) => (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

describe('diary goals', () => {
    it('edits a stored goal, or none, as a draft', () => {
        expect(diaryGoalDraft('words_per_day', 500)).toEqual({ type: 'words_per_day', target: '500' });
        expect(diaryGoalDraft(null, null)).toBe(NO_DIARY_GOAL);
        expect(diaryGoalDraft('entries_per_week', null)).toBe(NO_DIARY_GOAL);
    });

    it('reads a draft into the fields the API takes', () => {
        const t = translate('en');
        expect(readDiaryGoal(NO_DIARY_GOAL, t, 'en')).toEqual({ fields: { goalType: null, goalTarget: null } });
        expect(readDiaryGoal({ type: 'entries_per_week', target: ' 3 ' }, t, 'en')).toEqual({ fields: { goalType: 'entries_per_week', goalTarget: 3 } });
        expect(readDiaryGoal({ type: 'words_per_day', target: '10000' }, t, 'en')).toEqual({ fields: { goalType: 'words_per_day', goalTarget: 10000 } });
    });

    it.each([
        ['en', { type: 'words_per_day', target: '9' }, 'Enter a whole number from 10 to 10,000 for the writing goal.'],
        ['fr', { type: 'words_per_day', target: '' }, `Saisissez un nombre entier de 10 à ${(10000).toLocaleString('fr')} pour l’objectif d’écriture.`],
        ['en', { type: 'entries_per_week', target: '2.5' }, 'Enter a whole number from 1 to 50 for the writing goal.'],
        ['en', { type: 'entries_per_week', target: '51' }, 'Enter a whole number from 1 to 50 for the writing goal.'],
    ] as const)('refuses a target outside its bounds in %s', (language, draft, message) => {
        expect(readDiaryGoal(draft, translate(language), language)).toEqual({ error: message });
    });

    it.each([
        ['en', 'entries_per_week', 1, '1 entry a week'],
        ['en', 'words_per_day', 750, '750 words a day'],
        ['fr', 'entries_per_week', 1, '1 entrée par semaine'],
        ['fr', 'words_per_day', 2, '2 mots par jour'],
    ] as const)('describes a goal in %s', (language, type, target, text) => {
        expect(describeDiaryGoal(translate(language), language, type, target)).toBe(text);
    });
});

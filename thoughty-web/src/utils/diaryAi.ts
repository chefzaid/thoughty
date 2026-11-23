import type { Diary } from '../types';
import type { ApiErrorTranslationKey } from './translations.apiErrors';

/** A diary as far as its AI privacy mode goes. */
type AiModeDiary = Pick<Diary, 'id'> & Partial<Pick<Diary, 'aiMode' | 'isDefault'>>;

/**
 * Whether the diary `diaryId` has AI off, so no AI action is offered on what is written in it (the server
 * refuses them too). An entry without a diary, or a diary not loaded, does not.
 */
export function isDiaryAiOff(diaries: readonly AiModeDiary[], diaryId: number | null | undefined): boolean {
  return diaryId != null && diaries.some((diary) => diary.id === diaryId && diary.aiMode === 'off');
}

/** The diary the composer writes into: the chosen one, or the default one for all diaries. */
export function composerDiaryId(diaries: readonly AiModeDiary[], currentDiaryId: number | null): number | undefined {
  return currentDiaryId ?? diaries.find((diary) => diary.isDefault)?.id;
}

/** Whether the composer writes into a diary with AI off. */
export function isComposerDiaryAiOff(diaries: readonly AiModeDiary[], currentDiaryId: number | null): boolean {
  return isDiaryAiOff(diaries, composerDiaryId(diaries, currentDiaryId));
}

/**
 * Whether the server refused an AI request because its diary has AI off: the diary was turned off on another
 * device since this page loaded the diaries, which it then reloads so the AI actions leave that diary.
 */
export function isDiaryAiOffRefusal(refusal: ApiErrorTranslationKey | null): boolean {
  return refusal === 'apiError_DIARY_AI_OFF';
}

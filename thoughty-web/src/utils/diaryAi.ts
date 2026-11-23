import type { Diary } from '../types';

/** A diary as far as its AI privacy mode goes. */
type AiModeDiary = Pick<Diary, 'id'> & Partial<Pick<Diary, 'aiMode' | 'isDefault'>>;

/**
 * Whether the diary `diaryId` has AI off, so no AI action is offered on what is written in it (the server
 * refuses them too). An entry without a diary, or a diary not loaded, does not.
 */
export function isDiaryAiOff(diaries: readonly AiModeDiary[], diaryId: number | null | undefined): boolean {
  return diaryId != null && diaries.some((diary) => diary.id === diaryId && diary.aiMode === 'off');
}

/** Whether the composer writes into a diary with AI off: the chosen one, or the default one for all diaries. */
export function isComposerDiaryAiOff(diaries: readonly AiModeDiary[], currentDiaryId: number | null): boolean {
  return isDiaryAiOff(diaries, currentDiaryId ?? diaries.find((diary) => diary.isDefault)?.id);
}

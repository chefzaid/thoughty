import type { Diary } from '../types';
import type { DiaryAiTranslationKey } from './translations.diaryAi';
import type { ApiErrorTranslationKey } from './translations.apiErrors';

/** A diary as far as its AI privacy mode goes. */
type AiModeDiary = Pick<Diary, 'id'> & Partial<Pick<Diary, 'aiMode' | 'isDefault'>>;

/** What the AI may read of a diary: everything, nothing, or one request at a time the writer agreed to. */
export type DiaryAiMode = Diary['aiMode'];

/** The AI mode of the diary `diaryId`; on for an entry without a diary, or a diary not loaded. */
export function diaryAiMode(diaries: readonly AiModeDiary[], diaryId: number | null | undefined): DiaryAiMode {
  return (diaryId == null ? undefined : diaries.find((diary) => diary.id === diaryId)?.aiMode) ?? 'on';
}

/**
 * Whether the diary `diaryId` has AI off, so no AI action is offered on what is written in it (the server
 * refuses them too). An entry without a diary, or a diary not loaded, does not.
 */
export function isDiaryAiOff(diaries: readonly AiModeDiary[], diaryId: number | null | undefined): boolean {
  return diaryAiMode(diaries, diaryId) === 'off';
}

/** The diary the composer writes into: the chosen one, or the default one for all diaries. */
export function composerDiaryId(diaries: readonly AiModeDiary[], currentDiaryId: number | null): number | undefined {
  return currentDiaryId ?? diaries.find((diary) => diary.isDefault)?.id;
}

/**
 * Whether the server refused an AI request because of its diary's AI mode (AI off, or asking each time with no
 * consent sent): the mode was changed on another device since this page loaded the diaries, which it then
 * reloads so the AI actions follow it.
 */
export function isDiaryAiModeRefusal(refusal: ApiErrorTranslationKey | null): boolean {
  return refusal === 'apiError_DIARY_AI_OFF' || refusal === 'apiError_DIARY_AI_CONSENT_REQUIRED';
}

/** How a journal-wide AI action stands with the diary it reads (`null` for all diaries). */
export interface DiaryAiScope {
  /**
   * The one diary it reads has AI off or asks each time (a journal-wide action has no single text to show), so
   * the action reads nothing and is not offered.
   */
  readonly aiOff: boolean;
  /** What the page says in place of the action while `aiOff`. */
  readonly notice: Extract<DiaryAiTranslationKey, 'diaryAiOffNotice' | 'diaryAiAskNotice'>;
  /** It reads all diaries and some have AI off or ask each time, which it leaves out. */
  readonly aiOffLeftOut: boolean;
}

/** Whether a journal-wide AI action on `diaryId` (all diaries when null) is off, or leaves diaries out. */
export function diaryAiScope(diaries: readonly AiModeDiary[], diaryId: number | null | undefined): DiaryAiScope {
  const mode = diaryAiMode(diaries, diaryId);
  return {
    aiOff: mode !== 'on',
    notice: mode === 'ask' ? 'diaryAiAskNotice' : 'diaryAiOffNotice',
    aiOffLeftOut: diaryId == null && diaries.some((diary) => (diary.aiMode ?? 'on') !== 'on'),
  };
}

/** The scope of a journal-wide AI action when every diary it reads has AI on. */
export const ALL_DIARIES_AI_ON: DiaryAiScope = { aiOff: false, notice: 'diaryAiOffNotice', aiOffLeftOut: false };

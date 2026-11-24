import type { Diary } from '../types';
import type { DiaryAiTranslationKey } from './translations.diaryAi';
import type { ApiErrorTranslationKey } from './translations.apiErrors';

/** A diary as far as its AI privacy mode goes. */
type AiModeDiary = Pick<Diary, 'id'> & Partial<Pick<Diary, 'aiMode' | 'isDefault'>>;

/**
 * What the AI may read of a diary: everything, nothing, one request at a time the writer agreed to, or only the
 * writer's own model, which this browser calls (`local`; Thoughty's server treats such a diary as AI off).
 */
export type DiaryAiMode = Diary['aiMode'];

/** An AI action on one text or entry of a diary. */
export type DiaryAiTask = 'tag' | 'writing' | 'summary' | 'chat' | 'prompt' | 'transcription';

/**
 * The AI actions a diary on the writer's own model sends there from this browser: the text ones with the server's
 * prompts, and transcription to its speech-to-text endpoint (`/audio/transcriptions`). That is every one of them.
 */
export const LOCAL_MODEL_TASKS: readonly DiaryAiTask[] = ['writing', 'tag', 'summary', 'chat', 'prompt', 'transcription'];

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

/**
 * Whether a diary in `mode` offers the AI action `task` on one of its texts: every one but with AI off, and in a
 * diary on the writer's own model only those that model takes (`LOCAL_MODEL_TASKS`).
 */
export function diaryOffersAi(mode: DiaryAiMode, task: DiaryAiTask): boolean {
  if (mode === 'local') return LOCAL_MODEL_TASKS.includes(task);
  return mode !== 'off';
}

/** What Manage Diaries says of a diary whose AI is not simply on. */
export const DIARY_AI_MODE_SUMMARIES: Record<Exclude<DiaryAiMode, 'on'>, DiaryAiTranslationKey> = {
  off: 'diaryAiOffSummary',
  ask: 'diaryAiAskSummary',
  local: 'diaryAiLocalSummary',
};

/** The diary the composer writes into: the chosen one, or the default one for all diaries. */
export function composerDiaryId(diaries: readonly AiModeDiary[], currentDiaryId: number | null): number | undefined {
  return currentDiaryId ?? diaries.find((diary) => diary.isDefault)?.id;
}

const DIARY_AI_MODE_REFUSALS: readonly string[] = [
  'apiError_DIARY_AI_OFF',
  'apiError_DIARY_AI_CONSENT_REQUIRED',
  'apiError_DIARY_AI_LOCAL',
] satisfies ApiErrorTranslationKey[];

/**
 * Whether the server refused an AI request because of its diary's AI mode (AI off, asking each time with no
 * consent sent, or the writer's own model only): the mode was changed on another device since this page loaded
 * the diaries, which it then reloads so the AI actions follow it.
 */
export function isDiaryAiModeRefusal(refusal: string | null): boolean {
  return refusal !== null && DIARY_AI_MODE_REFUSALS.includes(refusal);
}

/** How a journal-wide AI action stands with the diary it reads (`null` for all diaries). */
export interface DiaryAiScope {
  /**
   * The one diary it reads has AI off, asks each time (a journal-wide action has no single text to show) or uses
   * only the writer's own model (which takes one text at a time), so the action reads nothing and is not offered.
   */
  readonly aiOff: boolean;
  /** What the page says in place of the action while `aiOff`. */
  readonly notice: Extract<DiaryAiTranslationKey, 'diaryAiOffNotice' | 'diaryAiAskNotice' | 'diaryAiLocalNotice'>;
  /** It reads all diaries and some have AI off, ask each time or use the writer's own model, which it leaves out. */
  readonly aiOffLeftOut: boolean;
}

const SCOPE_NOTICES: Record<DiaryAiMode, DiaryAiScope['notice']> = {
  on: 'diaryAiOffNotice',
  off: 'diaryAiOffNotice',
  ask: 'diaryAiAskNotice',
  local: 'diaryAiLocalNotice',
};

/** Whether a journal-wide AI action on `diaryId` (all diaries when null) is off, or leaves diaries out. */
export function diaryAiScope(diaries: readonly AiModeDiary[], diaryId: number | null | undefined): DiaryAiScope {
  const mode = diaryAiMode(diaries, diaryId);
  return {
    aiOff: mode !== 'on',
    notice: SCOPE_NOTICES[mode],
    aiOffLeftOut: diaryId == null && diaries.some((diary) => (diary.aiMode ?? 'on') !== 'on'),
  };
}

/** The scope of a journal-wide AI action when every diary it reads has AI on. */
export const ALL_DIARIES_AI_ON: DiaryAiScope = { aiOff: false, notice: 'diaryAiOffNotice', aiOffLeftOut: false };

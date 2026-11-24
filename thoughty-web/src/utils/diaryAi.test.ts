import { describe, expect, it } from 'vitest';
import {
  ALL_DIARIES_AI_ON,
  DIARY_AI_MODE_SUMMARIES,
  composerDiaryId,
  diaryAiMode,
  diaryAiScope,
  diaryOffersAi,
  isDiaryAiModeRefusal,
  isDiaryAiOff,
  type DiaryAiTask,
} from './diaryAi';

const diaries = [
  { id: 1, aiMode: 'on' as const, isDefault: true },
  { id: 2, aiMode: 'off' as const, isDefault: false },
  { id: 3 },
  { id: 4, aiMode: 'ask' as const },
  { id: 5, aiMode: 'local' as const },
];

describe('diary AI mode', () => {
  it('tells a diary with AI off from one with AI on, without a mode, unknown or none', () => {
    expect(isDiaryAiOff(diaries, 2)).toBe(true);
    expect(isDiaryAiOff(diaries, 1)).toBe(false);
    expect(isDiaryAiOff(diaries, 3)).toBe(false);
    expect(isDiaryAiOff(diaries, 4)).toBe(false);
    expect(isDiaryAiOff(diaries, 9)).toBe(false);
    expect(isDiaryAiOff(diaries, null)).toBe(false);
    expect(isDiaryAiOff(diaries, undefined)).toBe(false);
  });

  it('reads a diary’s mode, on without one, for an unknown diary or none', () => {
    expect(diaryAiMode(diaries, 4)).toBe('ask');
    expect(diaryAiMode(diaries, 2)).toBe('off');
    expect(diaryAiMode(diaries, 3)).toBe('on');
    expect(diaryAiMode(diaries, 9)).toBe('on');
    expect(diaryAiMode(diaries, null)).toBe('on');
  });

  it('reads the composer’s diary, or the default diary while all diaries are shown', () => {
    expect(composerDiaryId(diaries, 2)).toBe(2);
    expect(composerDiaryId(diaries, null)).toBe(1);
    expect(composerDiaryId([], null)).toBeUndefined();
  });

  it('tells the server’s refusals for a diary’s AI mode from any other', () => {
    expect(isDiaryAiModeRefusal('apiError_DIARY_AI_OFF')).toBe(true);
    expect(isDiaryAiModeRefusal('apiError_DIARY_AI_CONSENT_REQUIRED')).toBe(true);
    expect(isDiaryAiModeRefusal('apiError_DIARY_AI_LOCAL')).toBe(true);
    expect(isDiaryAiModeRefusal('localModelUnreachable')).toBe(false);
    expect(isDiaryAiModeRefusal('apiError_AI_KEY_NOT_CONFIGURED')).toBe(false);
    expect(isDiaryAiModeRefusal(null)).toBe(false);
  });

  it('says a journal-wide AI action on a diary with AI off or set to ask reads nothing, and one on all diaries leaves them out', () => {
    expect(diaryAiScope(diaries, 2)).toEqual({ aiOff: true, notice: 'diaryAiOffNotice', aiOffLeftOut: false });
    expect(diaryAiScope(diaries, 4)).toEqual({ aiOff: true, notice: 'diaryAiAskNotice', aiOffLeftOut: false });
    expect(diaryAiScope(diaries, 5)).toEqual({ aiOff: true, notice: 'diaryAiLocalNotice', aiOffLeftOut: false });
    expect(diaryAiScope([{ id: 1, aiMode: 'local' }], null)).toEqual({ ...ALL_DIARIES_AI_ON, aiOffLeftOut: true });
    expect(diaryAiScope(diaries, 1)).toEqual(ALL_DIARIES_AI_ON);
    expect(diaryAiScope(diaries, null)).toEqual({ ...ALL_DIARIES_AI_ON, aiOffLeftOut: true });
    expect(diaryAiScope(diaries, undefined)).toEqual({ ...ALL_DIARIES_AI_ON, aiOffLeftOut: true });
    expect(diaryAiScope([{ id: 1, aiMode: 'ask' }], null)).toEqual({ ...ALL_DIARIES_AI_ON, aiOffLeftOut: true });
    expect(diaryAiScope([{ id: 1, aiMode: 'on' }, { id: 2 }], null)).toEqual(ALL_DIARIES_AI_ON);
    expect(diaryAiScope([], null)).toEqual(ALL_DIARIES_AI_ON);
  });

  it('offers every AI action but with AI off, and in a diary on the writer’s own model only those it takes', () => {
    const tasks: DiaryAiTask[] = ['writing', 'tag', 'summary', 'chat', 'prompt', 'transcription'];
    const offered = (mode: 'on' | 'off' | 'ask' | 'local') => tasks.filter((task) => diaryOffersAi(mode, task));

    expect(offered('on')).toEqual(tasks);
    expect(offered('ask')).toEqual(tasks);
    expect(offered('off')).toEqual([]);
    expect(offered('local')).toEqual(['writing', 'tag', 'summary']);
  });

  it('names each mode that is not simply on in Manage Diaries', () => {
    expect(DIARY_AI_MODE_SUMMARIES).toEqual({ off: 'diaryAiOffSummary', ask: 'diaryAiAskSummary', local: 'diaryAiLocalSummary' });
  });
});

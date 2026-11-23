import { describe, expect, it } from 'vitest';
import { composerDiaryId, diaryAiScope, isComposerDiaryAiOff, isDiaryAiOff, isDiaryAiOffRefusal } from './diaryAi';

const diaries = [
  { id: 1, aiMode: 'on' as const, isDefault: true },
  { id: 2, aiMode: 'off' as const, isDefault: false },
  { id: 3 },
];

describe('diary AI mode', () => {
  it('tells a diary with AI off from one with AI on, without a mode, unknown or none', () => {
    expect(isDiaryAiOff(diaries, 2)).toBe(true);
    expect(isDiaryAiOff(diaries, 1)).toBe(false);
    expect(isDiaryAiOff(diaries, 3)).toBe(false);
    expect(isDiaryAiOff(diaries, 9)).toBe(false);
    expect(isDiaryAiOff(diaries, null)).toBe(false);
    expect(isDiaryAiOff(diaries, undefined)).toBe(false);
  });

  it('reads the composer’s diary, or the default diary while all diaries are shown', () => {
    expect(isComposerDiaryAiOff(diaries, 2)).toBe(true);
    expect(isComposerDiaryAiOff(diaries, null)).toBe(false);
    expect(isComposerDiaryAiOff([{ id: 2, aiMode: 'off', isDefault: true }], null)).toBe(true);
    expect(isComposerDiaryAiOff([], null)).toBe(false);
    expect(composerDiaryId(diaries, 2)).toBe(2);
    expect(composerDiaryId(diaries, null)).toBe(1);
    expect(composerDiaryId([], null)).toBeUndefined();
  });

  it('tells the server’s AI-off refusal from any other', () => {
    expect(isDiaryAiOffRefusal('apiError_DIARY_AI_OFF')).toBe(true);
    expect(isDiaryAiOffRefusal('apiError_AI_KEY_NOT_CONFIGURED')).toBe(false);
    expect(isDiaryAiOffRefusal(null)).toBe(false);
  });

  it('says a journal-wide AI action on a diary with AI off reads nothing, and one on all diaries leaves them out', () => {
    expect(diaryAiScope(diaries, 2)).toEqual({ aiOff: true, aiOffLeftOut: false });
    expect(diaryAiScope(diaries, 1)).toEqual({ aiOff: false, aiOffLeftOut: false });
    expect(diaryAiScope(diaries, null)).toEqual({ aiOff: false, aiOffLeftOut: true });
    expect(diaryAiScope(diaries, undefined)).toEqual({ aiOff: false, aiOffLeftOut: true });
    expect(diaryAiScope([{ id: 1, aiMode: 'on' }], null)).toEqual({ aiOff: false, aiOffLeftOut: false });
    expect(diaryAiScope([], null)).toEqual({ aiOff: false, aiOffLeftOut: false });
  });
});

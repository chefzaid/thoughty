import { describe, expect, it } from 'vitest';
import { isComposerDiaryAiOff, isDiaryAiOff } from './diaryAi';

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
  });
});

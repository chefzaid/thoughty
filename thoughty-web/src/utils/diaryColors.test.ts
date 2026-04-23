import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIARY_COLORS,
  getDiaryFallbackColor,
  normalizeDiaryColor,
  resolveDiaryColor,
  withAlpha,
} from './diaryColors';

describe('diaryColors', () => {
  it('normalizes valid colors and rejects invalid values', () => {
    expect(normalizeDiaryColor(' #e76f51 ')).toBe('#E76F51');
    expect(normalizeDiaryColor('#123abz')).toBeNull();
    expect(normalizeDiaryColor()).toBeNull();
  });

  it('returns deterministic fallback colors', () => {
    const colorFromString = getDiaryFallbackColor('daily-journal');
    const colorFromSameString = getDiaryFallbackColor('daily-journal');

    expect(colorFromString).toBe(colorFromSameString);
    expect(DEFAULT_DIARY_COLORS).toContain(colorFromString);
    expect(DEFAULT_DIARY_COLORS).toContain(getDiaryFallbackColor(42));
  });

  it('resolves explicit diary color when valid and falls back when invalid', () => {
    expect(resolveDiaryColor({ color: '#00ff00', id: 10, name: 'Work' })).toBe('#00FF00');

    const fallback = resolveDiaryColor({ color: 'invalid', id: 10, name: 'Work' });
    expect(DEFAULT_DIARY_COLORS).toContain(fallback);
  });

  it('converts hex colors to rgba and uses default rgba for invalid input', () => {
    expect(withAlpha('#00FF00', 0.25)).toBe('rgba(0, 255, 0, 0.25)');
    expect(withAlpha('oops', 0.5)).toBe('rgba(59, 130, 246, 0.5)');
  });
});

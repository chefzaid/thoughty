import { describe, expect, it } from 'vitest';
import {
  CURATED_FEELINGS,
  MAX_FEELINGS,
  addFeeling,
  describeMood,
  feelingLabel,
  isMoodFilter,
  isMoodLevel,
  moodLabelKey,
  nearestMoodLevel,
  normalizeFeeling,
  resolveFeeling,
  toggleFeeling,
} from './entryMood';
import { moodTranslations } from './translations.mood';

const t = (key: string) => key;
const french = (key: string) => moodTranslations.fr[key as keyof typeof moodTranslations.fr] ?? key;

describe('entryMood', () => {
  it('accepts only the five levels of the scale', () => {
    expect([1, 2, 3, 4, 5].every(isMoodLevel)).toBe(true);
    expect([0, 6, 2.5, null, undefined, '3'].some(isMoodLevel)).toBe(false);
    expect(moodLabelKey(4)).toBe('moodLevel4');
  });

  it('reads an average as the level it falls closest to', () => {
    expect(nearestMoodLevel(3.6)).toBe(4);
    expect(nearestMoodLevel(3.4)).toBe(3);
    expect(nearestMoodLevel(0.2)).toBe(1);
    expect(nearestMoodLevel(7)).toBe(5);
  });

  it('labels every curated feeling in English and French, and a typed word as typed', () => {
    for (const feeling of CURATED_FEELINGS) {
      expect(feelingLabel(feeling, french)).not.toMatch(/^feeling/);
    }
    expect(feelingLabel('calm', french)).toBe('calme');
    expect(feelingLabel('nostalgic', french)).toBe('nostalgic');
    expect(feelingLabel('calm', t)).toBe('feelingCalm');
  });

  it('cleans typed feelings the way the server stores them', () => {
    expect(normalizeFeeling('  Quietly   {Happy}, ')).toBe('quietly happy');
    expect(normalizeFeeling('x'.repeat(60))).toHaveLength(40);
  });

  it('maps a typed curated word in either language back to its key, accents aside', () => {
    expect(resolveFeeling('Calme')).toBe('calm');
    expect(resolveFeeling('ANXIETE')).toBe('anxious');
    expect(resolveFeeling('fierté')).toBe('proud');
    expect(resolveFeeling('Grateful')).toBe('grateful');
    expect(resolveFeeling('Nostalgic ')).toBe('nostalgic');
    expect(resolveFeeling('  ')).toBe('');
  });

  it('adds feelings once and never past the limit', () => {
    expect(addFeeling(['calm'], 'calme')).toEqual(['calm']);
    expect(addFeeling(['calm'], 'Nostalgic')).toEqual(['calm', 'nostalgic']);
    expect(addFeeling([], '')).toEqual([]);
    const full = Array.from({ length: MAX_FEELINGS }, (_, index) => `word ${index}`);
    expect(addFeeling(full, 'one more')).toEqual(full);
    expect(toggleFeeling(full, 'calm')).toEqual(full);
    expect(toggleFeeling(['calm', 'tired'], 'calm')).toEqual(['tired']);
    expect(toggleFeeling(['tired'], 'calm')).toEqual(['tired', 'calm']);
  });

  it('describes a mood with its feelings for history and screen readers', () => {
    expect(describeMood(4, ['calm', 'nostalgic'], french)).toBe('Bonne · calme, nostalgic');
    expect(describeMood(null, ['tired'], french)).toBe('fatigue');
    expect(describeMood(2, [], french)).toBe('Basse');
    expect(describeMood(undefined, undefined, french)).toBe('');
  });

  it('knows the filter values the server accepts', () => {
    expect(['', 'any', 'none', '4,5', '1,2', '3'].every(isMoodFilter)).toBe(true);
    expect(['6', 'happy', '4,5,6'].some(isMoodFilter)).toBe(false);
  });
});

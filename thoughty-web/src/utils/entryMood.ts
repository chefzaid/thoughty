import type { TranslationFunction } from '../types';
import { moodTranslations, type MoodTranslationKey } from './translations.mood';

/** The mood scale runs from 1 (very low) to 5 (very good). */
export const MOOD_LEVELS = [1, 2, 3, 4, 5] as const;
export type MoodLevel = (typeof MOOD_LEVELS)[number];

/** As the server stores them: at most ten feelings of at most 40 characters. */
export const MAX_FEELINGS = 10;
export const MAX_FEELING_LENGTH = 40;

/** Decoration only: each level is always shown with its label too. */
const MOOD_EMOJI: Record<MoodLevel, string> = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };

/**
 * The curated feeling words, stored by their English key whatever the writer's language, so
 * stats and filters count "calm" and "calme" as one feeling.
 */
export const CURATED_FEELINGS = [
  'joyful', 'grateful', 'calm', 'hopeful', 'proud', 'loved', 'energized', 'content', 'curious', 'relieved',
  'tired', 'stressed', 'anxious', 'sad', 'lonely', 'angry', 'frustrated', 'overwhelmed', 'bored', 'confused',
] as const;

export function isMoodLevel(value: unknown): value is MoodLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function moodEmoji(level: MoodLevel): string {
  return MOOD_EMOJI[level];
}

export function moodLabelKey(level: MoodLevel): MoodTranslationKey {
  return `moodLevel${level}`;
}

/** The level an average falls closest to, so "3.6" reads as "Good". */
export function nearestMoodLevel(average: number): MoodLevel {
  const rounded = Math.min(5, Math.max(1, Math.round(average)));
  return rounded as MoodLevel;
}

function curatedKey(feeling: string): MoodTranslationKey | null {
  return (CURATED_FEELINGS as readonly string[]).includes(feeling)
    ? `feeling${feeling.charAt(0).toUpperCase()}${feeling.slice(1)}` as MoodTranslationKey
    : null;
}

/** A curated feeling in the writer's language; a word the writer typed, as typed. */
export function feelingLabel(feeling: string, t: TranslationFunction): string {
  const key = curatedKey(feeling);
  return key ? t(key) : feeling;
}

/** The same clean-up the server applies, so the chips show what will be saved. */
export function normalizeFeeling(value: string): string {
  return value
    .replaceAll(/[,;|{}[\]`"]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_FEELING_LENGTH)
    .trim();
}

function fold(value: string): string {
  return value.normalize('NFD').replaceAll(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * A typed feeling, mapped back to its curated key when it is one of the listed words in English
 * or French ("Calme" and "calm" both become `calm`), accents and case aside.
 */
export function resolveFeeling(value: string): string {
  const cleaned = normalizeFeeling(value);
  if (!cleaned) {
    return '';
  }
  const folded = fold(cleaned);
  const match = CURATED_FEELINGS.find((feeling) => {
    const key = curatedKey(feeling) as MoodTranslationKey;
    return fold(feeling) === folded || fold(moodTranslations.en[key]) === folded || fold(moodTranslations.fr[key]) === folded;
  });
  return match ?? cleaned;
}

/** Adds the feeling, or removes it when it is already chosen; never more than the limit. */
export function toggleFeeling(feelings: readonly string[], feeling: string): string[] {
  if (feelings.includes(feeling)) {
    return feelings.filter((chosen) => chosen !== feeling);
  }
  return feelings.length >= MAX_FEELINGS ? [...feelings] : [...feelings, feeling];
}

/** Adds a typed feeling once, resolved to its curated key when it has one. */
export function addFeeling(feelings: readonly string[], typed: string): string[] {
  const feeling = resolveFeeling(typed);
  if (!feeling || feelings.includes(feeling) || feelings.length >= MAX_FEELINGS) {
    return [...feelings];
  }
  return [...feelings, feeling];
}

/** The journal's mood filter: every level, any mood, no mood, or the two ends of the scale. */
export const MOOD_FILTER_OPTIONS = [
  { value: '', labelKey: 'moodFilterAll' },
  { value: 'any', labelKey: 'moodFilterAny' },
  { value: 'none', labelKey: 'moodFilterNone' },
  { value: '4,5', labelKey: 'moodFilterHigh' },
  { value: '1,2', labelKey: 'moodFilterLow' },
  { value: '5', labelKey: 'moodLevel5' },
  { value: '4', labelKey: 'moodLevel4' },
  { value: '3', labelKey: 'moodLevel3' },
  { value: '2', labelKey: 'moodLevel2' },
  { value: '1', labelKey: 'moodLevel1' },
] as const satisfies ReadonlyArray<{ value: string; labelKey: MoodTranslationKey }>;

export type MoodFilter = (typeof MOOD_FILTER_OPTIONS)[number]['value'];

export function isMoodFilter(value: string): value is MoodFilter {
  return MOOD_FILTER_OPTIONS.some((option) => option.value === value);
}

/** "Good · calm, hopeful" in the writer's language, for revision history and sr-only text. */
export function describeMood(mood: number | null | undefined, feelings: readonly string[] | undefined, t: TranslationFunction): string {
  const parts = [
    isMoodLevel(mood) ? t(moodLabelKey(mood)) : null,
    feelings && feelings.length > 0 ? feelings.map((feeling) => feelingLabel(feeling, t)).join(', ') : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

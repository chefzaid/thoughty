import type { YearReview } from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';

export type CountKey = 'reviewEntries' | 'reviewWords' | 'reviewDays';

/** "1 entry", "214 entries", "0 entrée" in French, which counts zero as singular. */
export function countPhrase(t: TranslationFunction, key: CountKey, count: number, language: Language): string {
  const form = new Intl.PluralRules(language).select(count) === 'one' ? 'one' : 'other';
  return t(`${key}_${form}`, { count: count.toLocaleString(language) });
}

/** "+12", "−3", or "±0". */
export function formatChange(current: number, previous: number, language: Language): string {
  const change = current - previous;
  if (change === 0) {
    return '±0';
  }
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toLocaleString(language)}`;
}

/** In January the year just finished is the one to look back on. */
export function defaultReviewYear(now = new Date()): number {
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
}

/** Index of the largest value, or -1 when every value is zero. */
export function busiestIndex(values: number[]): number {
  const most = Math.max(0, ...values);
  return most > 0 ? values.indexOf(most) : -1;
}

/** Numbers only by default; tag names are added only when the writer asks. */
export function buildShareText(review: YearReview, language: Language, t: TranslationFunction, includeThemes: boolean): string {
  const summary = t('reviewShareText', {
    year: review.year,
    entries: countPhrase(t, 'reviewEntries', review.totals.entries, language),
    words: countPhrase(t, 'reviewWords', review.totals.words, language),
    days: countPhrase(t, 'reviewDays', review.totals.writingDays, language),
    streak: countPhrase(t, 'reviewDays', review.totals.longestStreak, language),
  });
  const themes = review.topTags.slice(0, 3).map((tag) => tag.tag);
  return includeThemes && themes.length > 0 ? `${summary} ${t('reviewShareThemes', { tags: themes.join(', ') })}` : summary;
}

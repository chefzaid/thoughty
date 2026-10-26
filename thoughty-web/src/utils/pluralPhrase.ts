import type { TranslationFunction } from '../types';
import type { Language } from './translations';

/**
 * Fills `<key>_one` or `<key>_other`, picked by the language's plural rules, with the count written for the reader
 * ("1 entry", "3 entries", and in French "0 entrée", which counts zero as singular) and any other parameters.
 */
export function pluralPhrase(
  t: TranslationFunction,
  key: string,
  count: number,
  language: Language,
  params: Record<string, string | number> = {},
): string {
  const form = new Intl.PluralRules(language).select(count) === 'one' ? 'one' : 'other';
  return t(`${key}_${form}`, { ...params, count: count.toLocaleString(language) });
}

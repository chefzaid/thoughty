import type { Language } from './translations';

/** Very common words that set English and French text apart (short, unambiguous across the two languages). */
const LANGUAGE_MARKERS: Readonly<Record<Language, ReadonlySet<string>>> = {
  en: new Set([
    'the', 'and', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'it', 'that', 'this', 'with', 'for',
    'my', 'i', 'you', 'we', 'they', 'have', 'has', 'had', 'not', 'but', 'what', 'about', 'today',
    'be', 'been', 'from', 'at', 'so', 'just', 'our', 'your', 'will', 'would',
  ]),
  fr: new Set([
    'le', 'la', 'les', 'et', 'est', 'des', 'du', 'un', 'une', 'je', 'tu', 'il', 'elle', 'nous',
    'vous', 'ils', 'elles', 'que', 'qui', 'pour', 'dans', 'avec', 'sur', 'pas', 'mais', 'ce',
    'cette', 'mon', 'ma', 'mes', 'au', 'aux', 'été', 'suis', 'très', 'aujourd', 'avoir', 'être',
  ]),
};

const FRENCH_LETTERS = /[àâçéèêëîïôûùüÿœæ]/gi;
const MIN_MARKERS = 2;

/**
 * Guesses whether a text is English or French from its most common words and French accents.
 * Returns null when the text gives too little signal either way, so the caller keeps its default.
 */
export function detectSpeechLanguage(text: string): Language | null {
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  let en = 0;
  let fr = (text.match(FRENCH_LETTERS)?.length ?? 0) / 2;

  for (const word of words) {
    if (LANGUAGE_MARKERS.en.has(word)) en += 1;
    if (LANGUAGE_MARKERS.fr.has(word)) fr += 1;
  }

  if (Math.max(en, fr) < MIN_MARKERS || en === fr) return null;
  return fr > en ? 'fr' : 'en';
}

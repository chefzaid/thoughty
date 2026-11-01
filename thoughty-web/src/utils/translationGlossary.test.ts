import { describe, expect, it } from 'vitest';
import { translations, type Language, type TranslationKey } from './translations';

interface GlossaryTerm {
  /** The feature's one name in each language, as the strings below write it (case aside). */
  readonly name: Record<Language, string>;
  /** Strings that name the feature, which must use that name. */
  readonly keys: readonly TranslationKey[];
  /** Other names the feature must not go by anywhere in that language. */
  readonly never?: Partial<Record<Language, readonly string[]>>;
}

/**
 * Feature names that read the same in every string of a language, so text that names a feature
 * (a hint, a menu, a dialog title) matches the button that opens it. Add a feature, or a string
 * that names it, here.
 */
const GLOSSARY: Record<string, GlossaryTerm> = {
  highlights: {
    name: { en: 'Highlights', fr: 'Moments forts' },
    keys: ['highlights', 'highlightsTitle', 'seeHighlights', 'noHighlights', 'highlightsError', 'rereadDialogHint', 'personDateHelp'],
    never: { fr: ['À la une', 'mises en avant', 'temps forts'] },
  },
  onThisDay: {
    name: { en: 'On this day', fr: 'Ce jour-là' },
    keys: ['onThisDay', 'onThisDayEmailTitle', 'onThisDayEmailEnable', 'onThisDayEmailTurnedOn', 'onThisDayEmailTurnedOff', 'onThisDayEmailSaved'],
  },
  timeCapsule: {
    name: { en: 'time capsule', fr: 'capsule temporelle' },
    keys: ['timeCapsuleSeal', 'timeCapsuleCardTitle', 'timeCapsuleOpenEarlyTitle', 'timeCapsuleOpened', 'timeCapsuleOpenFailed'],
  },
  memoirNotThisWeek: {
    name: { en: 'Not this week', fr: 'Pas cette semaine' },
    keys: ['memoirSnooze', 'memoirSnoozeHint'],
  },
};

const LANGUAGES = Object.keys(translations) as Language[];

describe('feature names', () => {
  describe.each(Object.entries(GLOSSARY))('%s', (_feature, term) => {
    it.each(LANGUAGES)('is named the same way in every %s string that names it', (language) => {
      const misnamed = term.keys.filter((key) => !translations[language][key].toLowerCase().includes(term.name[language].toLowerCase()));

      expect(misnamed).toEqual([]);
    });

    it.each(LANGUAGES)('goes by no other name in %s', (language) => {
      const others = (term.never?.[language] ?? []).map((name) => name.toLowerCase());
      const offending = Object.entries(translations[language])
        .filter(([, text]) => others.some((name) => text.toLowerCase().includes(name)))
        .map(([key]) => key);

      expect(offending).toEqual([]);
    });
  });
});

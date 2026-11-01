import type { Language } from "./translations";

export type TopWordsTranslationKey =
  | "statsTopWordsTitle"
  | "statsTopWordsIntro"
  | "statsTopWordsEmpty"
  | "statsTopWordsCount_one"
  | "statsTopWordsCount_other"
  | "statsTopWordsOpen";

export const topWordsTranslations: Record<Language, Record<TopWordsTranslationKey, string>> = {
  en: {
    statsTopWordsTitle: "Words you use most",
    statsTopWordsIntro: "The words you used most in {month}, leaving out common English and French words. Each one searches the journal for it.",
    statsTopWordsEmpty: "The words you use at least twice this month will show here.",
    statsTopWordsCount_one: "{count} time",
    statsTopWordsCount_other: "{count} times",
    statsTopWordsOpen: "Search the journal for {word}",
  },
  fr: {
    statsTopWordsTitle: "Les mots que vous employez le plus",
    statsTopWordsIntro: "Les mots que vous avez le plus employés en {month}, sans les mots courants du français et de l’anglais. Chacun lance sa recherche dans le journal.",
    statsTopWordsEmpty: "Les mots que vous employez au moins deux fois ce mois-ci apparaîtront ici.",
    statsTopWordsCount_one: "{count} fois",
    statsTopWordsCount_other: "{count} fois",
    statsTopWordsOpen: "Rechercher « {word} » dans le journal",
  },
};

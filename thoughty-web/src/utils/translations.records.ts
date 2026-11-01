import type { Language } from "./translations";

export type RecordsTranslationKey =
  | "statsRecordsTitle"
  | "statsRecordsIntro"
  | "statsRecordsEmpty"
  | "statsRecordsLongestEntry"
  | "statsRecordsBusiestDay"
  | "statsRecordsLongestStreak"
  | "statsRecordsEarliest"
  | "statsRecordsLatest"
  | "statsRecordsFirstEntry"
  | "statsRecordsWords_one"
  | "statsRecordsWords_other"
  | "statsRecordsEntries_one"
  | "statsRecordsEntries_other"
  | "statsRecordsDays_one"
  | "statsRecordsDays_other"
  | "statsRecordsEntryOn"
  | "statsRecordsReadIt";

export const recordsTranslations: Record<Language, Record<RecordsTranslationKey, string>> = {
  en: {
    statsRecordsTitle: "Personal records",
    statsRecordsIntro: "Landmarks of your journal so far. Each one opens the entry or day that set it.",
    statsRecordsEmpty: "Your first entry starts the records: the longest entry, the busiest day, the longest streak and more.",
    statsRecordsLongestEntry: "Longest entry",
    statsRecordsBusiestDay: "Busiest day",
    statsRecordsLongestStreak: "Longest streak",
    statsRecordsEarliest: "Earliest hour",
    statsRecordsLatest: "Latest hour",
    statsRecordsFirstEntry: "Where it all began",
    statsRecordsWords_one: "{count} word",
    statsRecordsWords_other: "{count} words",
    statsRecordsEntries_one: "{count} entry",
    statsRecordsEntries_other: "{count} entries",
    statsRecordsDays_one: "{count} day in a row",
    statsRecordsDays_other: "{count} days in a row",
    statsRecordsEntryOn: "{date} · #{index}",
    statsRecordsReadIt: "Read it again",
  },
  fr: {
    statsRecordsTitle: "Records personnels",
    statsRecordsIntro: "Les repères de votre journal jusqu’ici. Chacun ouvre l’entrée ou le jour qui l’a établi.",
    statsRecordsEmpty: "Votre première entrée ouvre les records : la plus longue entrée, la journée la plus remplie, la plus longue série et plus encore.",
    statsRecordsLongestEntry: "Entrée la plus longue",
    statsRecordsBusiestDay: "Journée la plus remplie",
    statsRecordsLongestStreak: "Plus longue série",
    statsRecordsEarliest: "Heure la plus matinale",
    statsRecordsLatest: "Heure la plus tardive",
    statsRecordsFirstEntry: "Là où tout a commencé",
    statsRecordsWords_one: "{count} mot",
    statsRecordsWords_other: "{count} mots",
    statsRecordsEntries_one: "{count} entrée",
    statsRecordsEntries_other: "{count} entrées",
    statsRecordsDays_one: "{count} jour d’affilée",
    statsRecordsDays_other: "{count} jours d’affilée",
    statsRecordsEntryOn: "{date} · nº {index}",
    statsRecordsReadIt: "La relire",
  },
};

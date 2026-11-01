import type { Language } from "./translations";

export type WritingTimesTranslationKey =
  | "statsWritingTimesTitle"
  | "statsWritingTimesIntro"
  | "statsWritingTimesEmpty"
  | "statsWritingTimesSummary"
  | "statsWritingTimesByHour"
  | "statsWritingTimesByWeekday"
  | "statsWritingTimesHoursChart"
  | "statsWritingTimesHour"
  | "statsWritingTimesWeekday"
  | "statsWritingTimesHowOften"
  | "statsWritingTimesLevelValue"
  | "statsWritingTimesLevelMost"
  | "statsWritingTimesLevelOften"
  | "statsWritingTimesLevelSometimes"
  | "statsWritingTimesLevelNone";

export const writingTimesTranslations: Record<Language, Record<WritingTimesTranslationKey, string>> = {
  en: {
    statsWritingTimesTitle: "When you write",
    statsWritingTimesIntro:
      "From the time you gave each entry, or the time you wrote it when it has none, in your time zone ({zone}).",
    statsWritingTimesEmpty: "Once you have written a few entries, this shows the hours and days you write most.",
    statsWritingTimesSummary: "You write most often around {hour}, and on {weekday}.",
    statsWritingTimesByHour: "By hour of the day",
    statsWritingTimesByWeekday: "By day of the week",
    statsWritingTimesHoursChart: "Entries by hour of the day: {hours}",
    statsWritingTimesHour: "Hour",
    statsWritingTimesWeekday: "Day",
    statsWritingTimesHowOften: "How often",
    statsWritingTimesLevelValue: "{label}: {level}",
    statsWritingTimesLevelMost: "most often",
    statsWritingTimesLevelOften: "often",
    statsWritingTimesLevelSometimes: "now and then",
    statsWritingTimesLevelNone: "not yet",
  },
  fr: {
    statsWritingTimesTitle: "Quand vous écrivez",
    statsWritingTimesIntro:
      "D’après l’heure donnée à chaque entrée, ou celle où vous l’avez écrite si elle n’en a pas, dans votre fuseau horaire ({zone}).",
    statsWritingTimesEmpty: "Après quelques entrées, vous verrez ici les heures et les jours où vous écrivez le plus.",
    statsWritingTimesSummary: "Vous écrivez le plus souvent vers {hour}, et le {weekday}.",
    statsWritingTimesByHour: "Par heure de la journée",
    statsWritingTimesByWeekday: "Par jour de la semaine",
    statsWritingTimesHoursChart: "Entrées par heure de la journée : {hours}",
    statsWritingTimesHour: "Heure",
    statsWritingTimesWeekday: "Jour",
    statsWritingTimesHowOften: "Fréquence",
    statsWritingTimesLevelValue: "{label} : {level}",
    statsWritingTimesLevelMost: "le plus souvent",
    statsWritingTimesLevelOften: "souvent",
    statsWritingTimesLevelSometimes: "de temps en temps",
    statsWritingTimesLevelNone: "pas encore",
  },
};

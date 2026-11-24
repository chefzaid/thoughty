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
  | "statsWritingTimesLevelNone"
  | "statsWritingTimesUntimedImports_one"
  | "statsWritingTimesUntimedImports_other"
  | "statsWritingTimesUntimedImportsQuiet";

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
    statsWritingTimesUntimedImports_one:
      "{count} imported entry has no time of day, so it is left out: it was saved when you imported it, not when you wrote it.",
    statsWritingTimesUntimedImports_other:
      "{count} imported entries have no time of day, so they are left out: they were saved when you imported them, not when you wrote them.",
    statsWritingTimesUntimedImportsQuiet:
      "Imported entries without a time of day are left out: they were saved when you imported them, not when you wrote them.",
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
    statsWritingTimesUntimedImports_one:
      "{count} entrée importée n’a pas d’heure, elle est donc laissée de côté : elle a été enregistrée à l’import, pas quand vous l’avez écrite.",
    statsWritingTimesUntimedImports_other:
      "{count} entrées importées n’ont pas d’heure, elles sont donc laissées de côté : elles ont été enregistrées à l’import, pas quand vous les avez écrites.",
    statsWritingTimesUntimedImportsQuiet:
      "Les entrées importées sans heure sont laissées de côté : elles ont été enregistrées à l’import, pas quand vous les avez écrites.",
  },
};

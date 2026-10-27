import type { Language } from './translations';

/** Writing goals per diary: the diary manager's goal field and their progress in the statistics. */
export type WritingGoalsTranslationKey =
  | "diaryGoal"
  | "diaryGoalNone"
  | "diaryGoalTypeEntriesPerWeek"
  | "diaryGoalTypeWordsPerDay"
  | "diaryGoalTarget"
  | "diaryGoalTargetRange"
  | "diaryGoalSummary"
  | "diaryGoalEntriesPerWeek_one"
  | "diaryGoalEntriesPerWeek_other"
  | "diaryGoalWordsPerDay_one"
  | "diaryGoalWordsPerDay_other"
  | "statsGoalProgressWeek_one"
  | "statsGoalProgressWeek_other"
  | "statsGoalProgressDay_one"
  | "statsGoalProgressDay_other"
  | "statsGoalMetWeek"
  | "statsGoalMetDay"
  | "statsGoalStreakWeeks_one"
  | "statsGoalStreakWeeks_other"
  | "statsGoalStreakDays_one"
  | "statsGoalStreakDays_other"
  | "statsGoalBestWeeks_one"
  | "statsGoalBestWeeks_other"
  | "statsGoalBestDays_one"
  | "statsGoalBestDays_other"
  | "statsGoalNone"
  | "statsGoalPerDiary"
  | "statsGoalPickDiary"
  | "statsGoalManage"
  | "statsHeatmapGoalMetDay"
  | "statsHeatmapGoalMetWeek"
  | "statsHeatmapGoalLegendDay"
  | "statsHeatmapGoalLegendWeek";

export const writingGoalsTranslations: Record<Language, Record<WritingGoalsTranslationKey, string>> = {
  en: {
    diaryGoal: "Writing goal",
    diaryGoalNone: "No goal",
    diaryGoalTypeEntriesPerWeek: "Entries per week",
    diaryGoalTypeWordsPerDay: "Words per day",
    diaryGoalTarget: "Goal target",
    diaryGoalTargetRange: "Enter a whole number from {min} to {max} for the writing goal.",
    diaryGoalSummary: "Goal: {goal}",
    diaryGoalEntriesPerWeek_one: "{count} entry a week",
    diaryGoalEntriesPerWeek_other: "{count} entries a week",
    diaryGoalWordsPerDay_one: "{count} word a day",
    diaryGoalWordsPerDay_other: "{count} words a day",
    statsGoalProgressWeek_one: "{progress} of {count} entry this week",
    statsGoalProgressWeek_other: "{progress} of {count} entries this week",
    statsGoalProgressDay_one: "{progress} of {count} word today",
    statsGoalProgressDay_other: "{progress} of {count} words today",
    statsGoalMetWeek: "Goal met this week",
    statsGoalMetDay: "Goal met today",
    statsGoalStreakWeeks_one: "Streak: {count} week",
    statsGoalStreakWeeks_other: "Streak: {count} weeks",
    statsGoalStreakDays_one: "Streak: {count} day",
    statsGoalStreakDays_other: "Streak: {count} days",
    statsGoalBestWeeks_one: "Best: {count} week",
    statsGoalBestWeeks_other: "Best: {count} weeks",
    statsGoalBestDays_one: "Best: {count} day",
    statsGoalBestDays_other: "Best: {count} days",
    statsGoalNone: "This diary has no writing goal yet.",
    statsGoalPerDiary: "Writing goals are set per diary, and none has one yet.",
    statsGoalPickDiary: "Writing goals are set per diary. Pick one to see its goal on the activity map.",
    statsGoalManage: "Set a writing goal",
    statsHeatmapGoalMetDay: "{label}, goal met",
    statsHeatmapGoalMetWeek: "{label}, weekly goal met",
    statsHeatmapGoalLegendDay: "Day that met the goal",
    statsHeatmapGoalLegendWeek: "Week that met the goal",
  },
  fr: {
    diaryGoal: "Objectif d’écriture",
    diaryGoalNone: "Aucun objectif",
    diaryGoalTypeEntriesPerWeek: "Entrées par semaine",
    diaryGoalTypeWordsPerDay: "Mots par jour",
    diaryGoalTarget: "Cible de l’objectif",
    diaryGoalTargetRange: "Saisissez un nombre entier de {min} à {max} pour l’objectif d’écriture.",
    diaryGoalSummary: "Objectif : {goal}",
    diaryGoalEntriesPerWeek_one: "{count} entrée par semaine",
    diaryGoalEntriesPerWeek_other: "{count} entrées par semaine",
    diaryGoalWordsPerDay_one: "{count} mot par jour",
    diaryGoalWordsPerDay_other: "{count} mots par jour",
    statsGoalProgressWeek_one: "{progress} sur {count} entrée cette semaine",
    statsGoalProgressWeek_other: "{progress} sur {count} entrées cette semaine",
    statsGoalProgressDay_one: "{progress} sur {count} mot aujourd’hui",
    statsGoalProgressDay_other: "{progress} sur {count} mots aujourd’hui",
    statsGoalMetWeek: "Objectif atteint cette semaine",
    statsGoalMetDay: "Objectif atteint aujourd’hui",
    statsGoalStreakWeeks_one: "Série : {count} semaine",
    statsGoalStreakWeeks_other: "Série : {count} semaines",
    statsGoalStreakDays_one: "Série : {count} jour",
    statsGoalStreakDays_other: "Série : {count} jours",
    statsGoalBestWeeks_one: "Record : {count} semaine",
    statsGoalBestWeeks_other: "Record : {count} semaines",
    statsGoalBestDays_one: "Record : {count} jour",
    statsGoalBestDays_other: "Record : {count} jours",
    statsGoalNone: "Ce journal n’a pas encore d’objectif d’écriture.",
    statsGoalPerDiary: "Les objectifs d’écriture se fixent par journal, et aucun n’en a encore.",
    statsGoalPickDiary: "Les objectifs d’écriture se fixent par journal. Choisissez-en un pour voir son objectif sur la carte d’activité.",
    statsGoalManage: "Fixer un objectif d’écriture",
    statsHeatmapGoalMetDay: "{label}, objectif atteint",
    statsHeatmapGoalMetWeek: "{label}, objectif de la semaine atteint",
    statsHeatmapGoalLegendDay: "Jour où l’objectif est atteint",
    statsHeatmapGoalLegendWeek: "Semaine où l’objectif est atteint",
  },
};

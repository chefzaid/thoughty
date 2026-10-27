import type { Language } from './translations';

/** The statistics page: overview, activity heatmap, correlation graph, tone and mood, subjects and personality insights. */
export type StatsTranslationKey =
  | "totalEntries"
  | "topTags"
  | "loadingStats"
  | "statsOverview"
  | "uniqueTags"
  | "yearsActive"
  | "avgPerYear"
  | "avgWordsPerEntry"
  | "avgReadingTime"
  | "thoughtsPerYear"
  | "thoughtsPerMonth"
  | "topTagsByYear"
  | "journalActivityByDay"
  | "correlationGraph"
  | "correlationGraphDescription"
  | "correlationEntriesAnalyzed_one"
  | "correlationEntriesAnalyzed_other"
  | "entryConnections"
  | "tagConnections"
  | "connectionStrength"
  | "sharedEntryCount_one"
  | "sharedEntryCount_other"
  | "noEntryConnections"
  | "noTagConnections"
  | "openConnectedEntry"
  | "toneMoodInsights"
  | "toneMoodInsightsDescription"
  | "dominantMood"
  | "dominantTone"
  | "analyzedEntries"
  | "moodMix"
  | "toneMix"
  | "toneMoodUnavailable"
  | "subjectsDiscussed"
  | "subjectsDiscussedDescription"
  | "subjectsDiscussedUnavailable"
  | "personalityInsights"
  | "personalityFromDate"
  | "personalityToDate"
  | "analyzePersonality"
  | "analyzingPersonality"
  | "personalityWordsAnalyzed"
  | "personalityDateRange"
  | "personalityInvalidDateRange"
  | "personalityAnalysisError"
  | "personalityUnavailable"
  | "personalityPrivacy"
  | "personalityDisclaimer"
  | "lessActivity"
  | "moreActivity"
  | "noJournalActivity"
  | "statsLoadError"
  | "statsHeatmapDay_one"
  | "statsHeatmapDay_other"
  | "statsHeatmapKeyboardHint"
  | "statsHeatmapKeyboardHintReadOnly"
  | "statsChartTableToggle"
  | "statsChartTag"
  | "statsChartValue_one"
  | "statsChartValue_other";

export const statsTranslations: Record<Language, Record<StatsTranslationKey, string>> = {
  en: {
    totalEntries: "Total Entries",
    topTags: "Top Tags",
    loadingStats: "Loading statistics...",
    statsOverview: "Overview of your journal entries and tags",
    uniqueTags: "Unique Tags",
    yearsActive: "Years Active",
    avgPerYear: "Avg. per Year",
    avgWordsPerEntry: "Avg. Words",
    avgReadingTime: "Avg. Read Time",
    thoughtsPerYear: "Entries per Year",
    thoughtsPerMonth: "Entries per Month",
    topTagsByYear: "Top Tags by Year",
    journalActivityByDay: "Journal Activity by Day",
    correlationGraph: "Connections",
    correlationGraphDescription:
      "Explore the strongest links between entries and tags across this journal scope.",
    correlationEntriesAnalyzed_one: "{count} entry analyzed",
    correlationEntriesAnalyzed_other: "{count} entries analyzed",
    entryConnections: "Related entries",
    tagConnections: "Tag network",
    connectionStrength: "Connection strength: {score}%",
    sharedEntryCount_one: "{count} shared entry",
    sharedEntryCount_other: "{count} shared entries",
    noEntryConnections:
      "Add shared tags to more entries to reveal connections.",
    noTagConnections: "Use tags together on entries to reveal a tag network.",
    openConnectedEntry: "Open entry {index} from {date}",
    toneMoodInsights: "Tone and Mood",
    toneMoodInsightsDescription: "AI analysis of your recent writing patterns.",
    dominantMood: "Dominant Mood",
    dominantTone: "Dominant Tone",
    analyzedEntries: "Analyzed entries",
    moodMix: "Mood Mix",
    toneMix: "Tone Mix",
    toneMoodUnavailable:
      "AI analysis is unavailable right now. Configure AI settings and try again later.",
    subjectsDiscussed: "Subjects Discussed",
    subjectsDiscussedDescription:
      "AI grouping of the recurring subjects in your recent entries.",
    subjectsDiscussedUnavailable:
      "Subject analysis is unavailable right now. Configure AI settings and try again later.",
    personalityInsights: "Writing Tendencies",
    personalityFromDate: "From",
    personalityToDate: "To",
    analyzePersonality: "Analyze",
    analyzingPersonality: "Analyzing",
    personalityWordsAnalyzed: "Words analyzed",
    personalityDateRange: "Date range",
    personalityInvalidDateRange: "The start date must be before the end date.",
    personalityAnalysisError:
      "Writing analysis could not be completed. Please try again.",
    personalityUnavailable:
      "Writing analysis is unavailable for this selection.",
    personalityPrivacy:
      "Your raw entries stay on this server. AI receives aggregate word and subject statistics only.",
    personalityDisclaimer:
      "These non-clinical tendencies reflect writing patterns, not your identity or a diagnosis.",
    lessActivity: "Less",
    moreActivity: "More",
    noJournalActivity: "No journaling activity yet.",
    statsLoadError: "Failed to load statistics",
    statsHeatmapDay_one: "{count} entry on {date}",
    statsHeatmapDay_other: "{count} entries on {date}",
    statsHeatmapKeyboardHint:
      "Arrow keys move by a day or a week, Page Up and Page Down by a month. Enter opens the day in the journal.",
    statsHeatmapKeyboardHintReadOnly:
      "Arrow keys move by a day or a week, Page Up and Page Down by a month.",
    statsChartTableToggle: "Show as table",
    statsChartTag: "Tag",
    statsChartValue_one: "{label}: {count} entry",
    statsChartValue_other: "{label}: {count} entries",
  },
  fr: {
    totalEntries: "Total des entrées",
    topTags: "Tags populaires",
    loadingStats: "Chargement des statistiques...",
    statsOverview: "Aperçu de vos entrées de journal et tags",
    uniqueTags: "Tags uniques",
    yearsActive: "Années actives",
    avgPerYear: "Moy. par an",
    avgWordsPerEntry: "Moy. mots",
    avgReadingTime: "Moy. lecture",
    thoughtsPerYear: "Entrées par an",
    thoughtsPerMonth: "Entrées par mois",
    topTagsByYear: "Top tags par année",
    journalActivityByDay: "Activité du journal par jour",
    correlationGraph: "Connexions",
    correlationGraphDescription:
      "Explorez les liens les plus forts entre les entrées et les tags de ce journal.",
    correlationEntriesAnalyzed_one: "{count} entrée analysée",
    correlationEntriesAnalyzed_other: "{count} entrées analysées",
    entryConnections: "Entrées liées",
    tagConnections: "Réseau de tags",
    connectionStrength: "Force de la connexion : {score} %",
    sharedEntryCount_one: "{count} entrée partagée",
    sharedEntryCount_other: "{count} entrées partagées",
    noEntryConnections:
      "Ajoutez des tags communs à plusieurs entrées pour révéler leurs liens.",
    noTagConnections:
      "Utilisez plusieurs tags ensemble pour révéler leur réseau.",
    openConnectedEntry: "Ouvrir l'entrée {index} du {date}",
    toneMoodInsights: "Ton et humeur",
    toneMoodInsightsDescription:
      "Analyse IA de vos tendances d'écriture récentes.",
    dominantMood: "Humeur dominante",
    dominantTone: "Ton dominant",
    analyzedEntries: "Entrées analysées",
    moodMix: "Répartition des humeurs",
    toneMix: "Répartition des tons",
    toneMoodUnavailable:
      "L'analyse IA est indisponible pour le moment. Configurez l'IA puis réessayez plus tard.",
    subjectsDiscussed: "Sujets abordés",
    subjectsDiscussedDescription:
      "Regroupement par IA des sujets récurrents dans vos entrées récentes.",
    subjectsDiscussedUnavailable:
      "L'analyse des sujets est indisponible pour le moment. Configurez l'IA puis réessayez plus tard.",
    personalityInsights: "Tendances d'écriture",
    personalityFromDate: "Du",
    personalityToDate: "Au",
    analyzePersonality: "Analyser",
    analyzingPersonality: "Analyse en cours",
    personalityWordsAnalyzed: "Mots analysés",
    personalityDateRange: "Période",
    personalityInvalidDateRange:
      "La date de début doit précéder la date de fin.",
    personalityAnalysisError:
      "L'analyse de l'écriture n'a pas pu aboutir. Veuillez réessayer.",
    personalityUnavailable:
      "L'analyse de l'écriture est indisponible pour cette sélection.",
    personalityPrivacy:
      "Vos entrées brutes restent sur ce serveur. L'IA ne reçoit que des statistiques agrégées sur les mots et les sujets.",
    personalityDisclaimer:
      "Ces tendances non cliniques reflètent des habitudes d'écriture, et non votre identité ou un diagnostic.",
    lessActivity: "Moins",
    moreActivity: "Plus",
    noJournalActivity: "Aucune activité de journal pour le moment.",
    statsLoadError: "Échec du chargement des statistiques",
    statsHeatmapDay_one: "{count} entrée le {date}",
    statsHeatmapDay_other: "{count} entrées le {date}",
    statsHeatmapKeyboardHint:
      "Les flèches avancent d’un jour ou d’une semaine, Page précédente et Page suivante d’un mois. Entrée ouvre le jour dans le journal.",
    statsHeatmapKeyboardHintReadOnly:
      "Les flèches avancent d’un jour ou d’une semaine, Page précédente et Page suivante d’un mois.",
    statsChartTableToggle: "Afficher en tableau",
    statsChartTag: "Tag",
    statsChartValue_one: "{label} : {count} entrée",
    statsChartValue_other: "{label} : {count} entrées",
  },
};

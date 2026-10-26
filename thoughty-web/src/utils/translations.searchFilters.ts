import type { Language } from './translations';

/** The journal search box (keyword and semantic), the filters and the year and month navigation. */
export type SearchFiltersTranslationKey =
  | "searchPlaceholder"
  | "filterTagsPlaceholder"
  | "filterDatePlaceholder"
  | "filterVisibility"
  | "allEntries"
  | "resetFilters"
  | "year"
  | "month"
  | "newerYears"
  | "olderYears"
  | "visibilityFilter"
  | "searchMode"
  | "keywordSearchMode"
  | "semanticSearchMode"
  | "semanticSearchPlaceholder"
  | "runSemanticSearch"
  | "searchingSemantic"
  | "semanticSearchError"
  | "semanticSearchCount"
  | "semanticSearchLimited";

export const searchFiltersTranslations: Record<Language, Record<SearchFiltersTranslationKey, string>> = {
  en: {
    searchPlaceholder: "Search content...",
    filterTagsPlaceholder: "Filter by tags...",
    filterDatePlaceholder: "Filter by date",
    filterVisibility: "Filter by visibility",
    allEntries: "All",
    resetFilters: "Reset Filters",
    year: "Year",
    month: "Month",
    newerYears: "Newer years",
    olderYears: "Older years",
    visibilityFilter: "Visibility",
    searchMode: "Search mode",
    keywordSearchMode: "Keywords",
    semanticSearchMode: "Meaning",
    semanticSearchPlaceholder: "Search by meaning or idea...",
    runSemanticSearch: "Search by meaning",
    searchingSemantic: "Searching entries by meaning...",
    semanticSearchError: "Meaning search is unavailable right now. Try again.",
    semanticSearchCount:
      "Closest matches: {matches}. Entries analyzed: {analyzed}.",
    semanticSearchLimited: "Only the 100 newest entries were analyzed.",
  },
  fr: {
    searchPlaceholder: "Rechercher...",
    filterTagsPlaceholder: "Filtrer par tags...",
    filterDatePlaceholder: "Filtrer par date",
    filterVisibility: "Filtrer par visibilité",
    allEntries: "Tous",
    resetFilters: "Réinitialiser",
    year: "Année",
    month: "Mois",
    newerYears: "Années plus récentes",
    olderYears: "Années plus anciennes",
    visibilityFilter: "Visibilité",
    searchMode: "Mode de recherche",
    keywordSearchMode: "Mots-clés",
    semanticSearchMode: "Sens",
    semanticSearchPlaceholder: "Rechercher par sens ou par idée...",
    runSemanticSearch: "Rechercher par sens",
    searchingSemantic: "Recherche des entrées par sens...",
    semanticSearchError: "La recherche par sens est indisponible. Réessayez.",
    semanticSearchCount:
      "Résultats proches : {matches}. Entrées analysées : {analyzed}.",
    semanticSearchLimited:
      "Seules les 100 entrées les plus récentes ont été analysées.",
  },
};

import type { Language } from './translations';

export type SearchTranslationKey =
  | 'searchEntriesLabel'
  | 'searchHelp'
  | 'searchSort'
  | 'searchSortRelevance'
  | 'searchSortDate';

export const searchTranslations: Record<Language, Record<SearchTranslationKey, string>> = {
  en: {
    searchEntriesLabel: 'Search entries',
    searchHelp:
      'Finds other forms of a word in English and French (walk finds walking), ignores accents, and completes the last word. Put "an exact phrase" in quotes, write -word to leave a word out, and OR between words to find either.',
    searchSort: 'Order of search results',
    searchSortRelevance: 'Best match',
    searchSortDate: 'Newest first',
  },
  fr: {
    searchEntriesLabel: 'Rechercher dans les entrées',
    searchHelp:
      'Trouve les autres formes d’un mot en français et en anglais (marcher trouve marchait), ignore les accents et complète le dernier mot. Mettez "une expression exacte" entre guillemets, écrivez -mot pour exclure un mot et OR entre deux mots pour trouver l’un ou l’autre.',
    searchSort: 'Ordre des résultats',
    searchSortRelevance: 'Pertinence',
    searchSortDate: 'Plus récentes',
  },
};

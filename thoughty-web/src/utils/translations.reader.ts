import type { Language } from './translations';

export type ReaderTranslationKey =
  | 'reader'
  | 'readerOpen'
  | 'readerOpenHint'
  | 'readerEmpty'
  | 'readerMonth'
  | 'readerMonthOf'
  | 'readerTitle'
  | 'readerHint'
  | 'readerClose'
  | 'readerPages'
  | 'readerPrevious'
  | 'readerNext'
  | 'readerFirst'
  | 'readerLast'
  | 'readerShown'
  | 'readerShownQuiet'
  | 'readerLoading'
  | 'readerLoadFailed'
  | 'readerRetry'
  | 'readerStartOver';

export const readerTranslations: Record<Language, Record<ReaderTranslationKey, string>> = {
  en: {
    reader: 'Read',
    readerOpen: 'Read like a book',
    readerOpenHint: 'Read the entries of the current filters one after another, oldest first',
    readerEmpty: 'No entry matches these filters, so there is nothing to read.',
    readerMonth: 'Read this month',
    readerMonthOf: 'Read {month} like a book',
    readerTitle: 'Reader',
    readerHint: 'Left and right arrows turn the page. Esc closes.',
    readerClose: 'Close',
    readerPages: 'Turn the page',
    readerPrevious: 'Previous',
    readerNext: 'Next',
    readerFirst: 'This is the first entry.',
    readerLast: 'This is the last entry.',
    readerShown: 'Entry {position} of {total}, {date}.',
    readerShownQuiet: '{date}.',
    readerLoading: 'Loading the entry…',
    readerLoadFailed: 'The entry could not be loaded. Try again.',
    readerRetry: 'Try again',
    readerStartOver: 'Start from the first entry',
  },
  fr: {
    reader: 'Lire',
    readerOpen: 'Lire comme un livre',
    readerOpenHint: 'Lire les entrées des filtres actuels l’une après l’autre, de la plus ancienne à la plus récente',
    readerEmpty: 'Aucune entrée ne correspond à ces filtres : il n’y a rien à lire.',
    readerMonth: 'Lire ce mois',
    readerMonthOf: 'Lire {month} comme un livre',
    readerTitle: 'Lecture',
    readerHint: 'Les flèches gauche et droite tournent la page. Échap ferme.',
    readerClose: 'Fermer',
    readerPages: 'Tourner la page',
    readerPrevious: 'Précédente',
    readerNext: 'Suivante',
    readerFirst: 'C’est la première entrée.',
    readerLast: 'C’est la dernière entrée.',
    readerShown: 'Entrée {position} sur {total}, {date}.',
    readerShownQuiet: '{date}.',
    readerLoading: 'Chargement de l’entrée…',
    readerLoadFailed: 'Impossible de charger l’entrée. Réessayez.',
    readerRetry: 'Réessayer',
    readerStartOver: 'Reprendre à la première entrée',
  },
};

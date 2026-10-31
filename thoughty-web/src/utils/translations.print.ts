import type { Language } from './translations';

/** Printing an entry or a day: the menu action, the day button, the options dialog and the printed page. */
export type PrintTranslationKey =
  | 'printEntry'
  | 'printDay'
  | 'printDayOf'
  | 'printEntryTitle'
  | 'printDayTitle'
  | 'printDayCount_one'
  | 'printDayCount_other'
  | 'printInclude'
  | 'printIncludeMood'
  | 'printIncludeTags'
  | 'printHint'
  | 'printConfirm'
  | 'printPreparing'
  | 'printAttached'
  | 'printVideoFrame';

export const printTranslations: Record<Language, Record<PrintTranslationKey, string>> = {
  en: {
    printEntry: 'Print',
    printDay: 'Print this day',
    printDayOf: 'Print this day, {date}',
    printEntryTitle: 'Print this entry',
    printDayTitle: 'Print this day',
    printDayCount_one: '{count} entry',
    printDayCount_other: '{count} entries',
    printInclude: 'Also print',
    printIncludeMood: 'Mood and feelings',
    printIncludeTags: 'Tags',
    printHint: 'The date, title, text and pictures print on a white page, without the app around them. Sealed time capsules are never printed.',
    printConfirm: 'Print',
    printPreparing: 'Preparing the pages…',
    printAttached: 'Attached: {name}',
    printVideoFrame: 'Video: {name}',
  },
  fr: {
    printEntry: 'Imprimer',
    printDay: 'Imprimer cette journée',
    printDayOf: 'Imprimer cette journée, {date}',
    printEntryTitle: 'Imprimer cette entrée',
    printDayTitle: 'Imprimer cette journée',
    printDayCount_one: '{count} entrée',
    printDayCount_other: '{count} entrées',
    printInclude: 'Imprimer aussi',
    printIncludeMood: 'Humeur et ressentis',
    printIncludeTags: 'Tags',
    printHint: 'La date, le titre, le texte et les images s’impriment sur une page blanche, sans l’application autour. Les capsules temporelles scellées ne sont jamais imprimées.',
    printConfirm: 'Imprimer',
    printPreparing: 'Préparation des pages…',
    printAttached: 'Pièce jointe : {name}',
    printVideoFrame: 'Vidéo : {name}',
  },
};

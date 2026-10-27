import type { Language } from './translations';

/** The journal calendar: the list/calendar switch and the month grid. */
export type CalendarTranslationKey =
  | 'journalLayout'
  | 'journalLayoutList'
  | 'journalLayoutCalendar'
  | 'calendarMonthGrid'
  | 'calendarPreviousYear'
  | 'calendarPreviousMonth'
  | 'calendarNextMonth'
  | 'calendarNextYear'
  | 'calendarToday'
  | 'calendarGoToYear'
  | 'calendarKeyboardHelp'
  | 'calendarLoading'
  | 'calendarLoadFailed'
  | 'calendarRetry'
  | 'calendarMonthEmpty'
  | 'calendarEntryCount_one'
  | 'calendarEntryCount_other'
  | 'calendarDayLabel'
  | 'calendarDayToday'
  | 'calendarMoreEntries'
  | 'calendarOpenEntry'
  | 'calendarEntryMood'
  | 'calendarUntitledEntry';

export const calendarTranslations: Record<Language, Record<CalendarTranslationKey, string>> = {
  en: {
    journalLayout: 'Journal layout',
    journalLayoutList: 'List',
    journalLayoutCalendar: 'Calendar',
    calendarMonthGrid: 'Entries of {month}',
    calendarPreviousYear: 'Previous year',
    calendarPreviousMonth: 'Previous month',
    calendarNextMonth: 'Next month',
    calendarNextYear: 'Next year',
    calendarToday: 'Today',
    calendarGoToYear: 'Go to year',
    calendarKeyboardHelp: 'Arrow keys move between days, Home and End go to the start or end of the week, Page Up and Page Down change the month (with Shift, the year), and Enter shows the day in the list.',
    calendarLoading: 'Loading the month…',
    calendarLoadFailed: 'The month could not be loaded.',
    calendarRetry: 'Try again',
    calendarMonthEmpty: 'No entries this month match the filters.',
    calendarEntryCount_one: '{count} entry',
    calendarEntryCount_other: '{count} entries',
    calendarDayLabel: '{date}: {count}',
    calendarDayToday: '{label}, today',
    calendarMoreEntries: '+{count}',
    calendarOpenEntry: 'Open {entry}',
    calendarEntryMood: '{entry}, mood: {mood}',
    calendarUntitledEntry: 'Entry {index}',
  },
  fr: {
    journalLayout: 'Présentation du journal',
    journalLayoutList: 'Liste',
    journalLayoutCalendar: 'Calendrier',
    calendarMonthGrid: 'Entrées de {month}',
    calendarPreviousYear: 'Année précédente',
    calendarPreviousMonth: 'Mois précédent',
    calendarNextMonth: 'Mois suivant',
    calendarNextYear: 'Année suivante',
    calendarToday: 'Aujourd’hui',
    calendarGoToYear: 'Aller à l’année',
    calendarKeyboardHelp: 'Les flèches passent d’un jour à l’autre, Début et Fin vont au début ou à la fin de la semaine, Page précédente et Page suivante changent de mois (avec Maj, d’année), et Entrée affiche le jour dans la liste.',
    calendarLoading: 'Chargement du mois…',
    calendarLoadFailed: 'Le mois n’a pas pu être chargé.',
    calendarRetry: 'Réessayer',
    calendarMonthEmpty: 'Aucune entrée de ce mois ne correspond aux filtres.',
    calendarEntryCount_one: '{count} entrée',
    calendarEntryCount_other: '{count} entrées',
    calendarDayLabel: '{date} : {count}',
    calendarDayToday: '{label}, aujourd’hui',
    calendarMoreEntries: '+{count}',
    calendarOpenEntry: 'Ouvrir {entry}',
    calendarEntryMood: '{entry}, humeur : {mood}',
    calendarUntitledEntry: 'Entrée {index}',
  },
};

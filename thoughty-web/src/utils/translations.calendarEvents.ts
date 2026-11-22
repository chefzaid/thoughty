import type { Language } from './translations';

/** Imported calendars: the import panel in Import/Export and the day's events beside the composer. */
export type CalendarEventsTranslationKey =
  | 'calendarImportTitle'
  | 'calendarImportDescription'
  | 'calendarImportChoose'
  | 'calendarImporting'
  | 'calendarImported_one'
  | 'calendarImported_other'
  | 'calendarSkippedRecurring_one'
  | 'calendarSkippedRecurring_other'
  | 'calendarEventCount_one'
  | 'calendarEventCount_other'
  | 'calendarNoEvents'
  | 'calendarClear'
  | 'calendarClearTitle'
  | 'calendarClearMessage'
  | 'calendarCleared'
  | 'calendarEventsLoadFailed'
  | 'calendarImportFailed'
  | 'calendarClearFailed'
  | 'calendarDayEvents'
  | 'calendarAllDay'
  | 'calendarRepeats'
  | 'calendarUntitled'
  | 'calendarWriteAbout'
  | 'calendarWriteAboutLabel'
  | 'calendarEventPrompt';

export const calendarEventsTranslations: Record<Language, Record<CalendarEventsTranslationKey, string>> = {
  en: {
    calendarImportTitle: 'Calendar',
    calendarImportDescription: 'Import a calendar file (.ics) exported from Google Calendar, Apple Calendar or Outlook. The composer then lists the events of the day you write about, a reminder of what happened. Importing the same file again updates its events. Repeating events show on each day they fall on.',
    calendarImportChoose: 'Choose a calendar file (.ics)',
    calendarImporting: 'Importing {name}…',
    calendarImported_one: 'Imported {count} event.',
    calendarImported_other: 'Imported {count} events.',
    calendarSkippedRecurring_one: '{count} repeating event could not be read and was left out.',
    calendarSkippedRecurring_other: '{count} repeating events could not be read and were left out.',
    calendarEventCount_one: '{count} imported event, last imported on {date}.',
    calendarEventCount_other: '{count} imported events, last imported on {date}.',
    calendarNoEvents: 'No calendar imported yet.',
    calendarClear: 'Remove imported events',
    calendarClearTitle: 'Remove the imported events?',
    calendarClearMessage: 'The events of every calendar you imported are removed from Thoughty. Your entries stay as they are.',
    calendarCleared: 'The imported events were removed.',
    calendarEventsLoadFailed: 'Your calendar could not be loaded.',
    calendarImportFailed: 'The calendar could not be imported. Try again.',
    calendarClearFailed: 'The imported events could not be removed. Try again.',
    calendarDayEvents: 'On your calendar',
    calendarAllDay: 'All day',
    calendarRepeats: 'Repeats',
    calendarUntitled: 'Untitled event',
    calendarWriteAbout: 'Write about it',
    calendarWriteAboutLabel: 'Write about “{summary}”',
    calendarEventPrompt: '{summary}: how was it?',
  },
  fr: {
    calendarImportTitle: 'Agenda',
    calendarImportDescription: 'Importez un fichier d’agenda (.ics) exporté depuis Google Agenda, Calendrier d’Apple ou Outlook. Le rédacteur liste alors les événements du jour dont vous écrivez, pour vous rappeler ce qui s’est passé. Importer le même fichier à nouveau met ses événements à jour. Les événements récurrents apparaissent chaque jour où ils ont lieu.',
    calendarImportChoose: 'Choisir un fichier d’agenda (.ics)',
    calendarImporting: 'Import de {name}…',
    calendarImported_one: '{count} événement importé.',
    calendarImported_other: '{count} événements importés.',
    calendarSkippedRecurring_one: '{count} événement récurrent n’a pas pu être lu et a été laissé de côté.',
    calendarSkippedRecurring_other: '{count} événements récurrents n’ont pas pu être lus et ont été laissés de côté.',
    calendarEventCount_one: '{count} événement importé, dernier import le {date}.',
    calendarEventCount_other: '{count} événements importés, dernier import le {date}.',
    calendarNoEvents: 'Aucun agenda importé pour l’instant.',
    calendarClear: 'Retirer les événements importés',
    calendarClearTitle: 'Retirer les événements importés ?',
    calendarClearMessage: 'Les événements de tous les agendas importés sont retirés de Thoughty. Vos entrées restent telles quelles.',
    calendarCleared: 'Les événements importés ont été retirés.',
    calendarEventsLoadFailed: 'Votre agenda n’a pas pu être chargé.',
    calendarImportFailed: 'L’agenda n’a pas pu être importé. Réessayez.',
    calendarClearFailed: 'Les événements importés n’ont pas pu être retirés. Réessayez.',
    calendarDayEvents: 'Dans votre agenda',
    calendarAllDay: 'Toute la journée',
    calendarRepeats: 'Récurrent',
    calendarUntitled: 'Événement sans titre',
    calendarWriteAbout: 'En parler',
    calendarWriteAboutLabel: 'Écrire à propos de « {summary} »',
    calendarEventPrompt: '{summary} : comment c’était ?',
  },
};

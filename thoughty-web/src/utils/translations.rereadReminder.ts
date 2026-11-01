import type { Language } from './translations';

/** Reread reminders: the entry menu action, its dialog, the card's note and the Highlights section. */
export type RereadReminderTranslationKey =
  | 'rereadRemindAction'
  | 'rereadDialogTitle'
  | 'rereadPresets'
  | 'rereadInAWeek'
  | 'rereadInAMonth'
  | 'rereadInAYear'
  | 'rereadDateLabel'
  | 'rereadDialogHint'
  | 'rereadDateInvalid'
  | 'rereadSave'
  | 'rereadSaveFailed'
  | 'rereadIndicator'
  | 'rereadRemove'
  | 'rereadRemoveFailed'
  | 'rereadHighlightsTitle'
  | 'rereadAskedFor'
  | 'rereadDone'
  | 'rereadDoneFor'
  | 'rereadDoneAnnouncement';

export const rereadReminderTranslations: Record<Language, Record<RereadReminderTranslationKey, string>> = {
  en: {
    rereadRemindAction: 'Remind me to reread…',
    rereadDialogTitle: 'Remind me to reread',
    rereadPresets: 'Quick choices',
    rereadInAWeek: 'In a week',
    rereadInAMonth: 'In a month',
    rereadInAYear: 'In a year',
    rereadDateLabel: 'Day to reread it',
    rereadDialogHint: 'On that day the entry appears in Highlights with “You asked to reread this”, until you mark it done. Setting another day replaces it.',
    rereadDateInvalid: 'Choose a day from tomorrow up to 50 years ahead.',
    rereadSave: 'Remind me',
    rereadSaveFailed: 'The reminder could not be saved. Try again.',
    rereadIndicator: 'Reread on {date}',
    rereadRemove: 'Remove the reminder to reread on {date}',
    rereadRemoveFailed: 'The reminder could not be removed. Try again.',
    rereadHighlightsTitle: 'You asked to reread this',
    rereadAskedFor: 'You asked for {date}',
    rereadDone: 'Done rereading',
    rereadDoneFor: 'Done rereading the entry of {date}',
    rereadDoneAnnouncement: 'The entry of {date} is off your reread list.',
  },
  fr: {
    rereadRemindAction: 'Me rappeler de relire…',
    rereadDialogTitle: 'Me rappeler de relire',
    rereadPresets: 'Choix rapides',
    rereadInAWeek: 'Dans une semaine',
    rereadInAMonth: 'Dans un mois',
    rereadInAYear: 'Dans un an',
    rereadDateLabel: 'Jour de relecture',
    rereadDialogHint: 'Ce jour-là, l’entrée apparaît dans les Moments forts avec « Vous avez demandé à relire ceci », jusqu’à ce que vous la marquiez comme relue. Choisir un autre jour remplace le rappel.',
    rereadDateInvalid: 'Choisissez un jour entre demain et dans 50 ans.',
    rereadSave: 'Me le rappeler',
    rereadSaveFailed: 'Le rappel n’a pas pu être enregistré. Réessayez.',
    rereadIndicator: 'À relire le {date}',
    rereadRemove: 'Retirer le rappel de relecture du {date}',
    rereadRemoveFailed: 'Le rappel n’a pas pu être retiré. Réessayez.',
    rereadHighlightsTitle: 'Vous avez demandé à relire ceci',
    rereadAskedFor: 'Prévu pour le {date}',
    rereadDone: 'Relecture terminée',
    rereadDoneFor: 'Relecture terminée pour l’entrée du {date}',
    rereadDoneAnnouncement: 'L’entrée du {date} est retirée de votre liste de relecture.',
  },
};

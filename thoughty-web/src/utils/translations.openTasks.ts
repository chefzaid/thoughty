import type { Language } from './translations';

export type OpenTasksTranslationKey =
  | 'openTasksNav'
  | 'openTasksTitle'
  | 'openTasksIntro'
  | 'openTasksLoading'
  | 'openTasksLoadError'
  | 'openTasksRetry'
  | 'openTasksEmpty'
  | 'openTasksEmptyDiary'
  | 'openTasksCount_one'
  | 'openTasksCount_other'
  | 'openTasksOpenEntry'
  | 'openTasksOpenEntryOf'
  | 'openTasksTicked'
  | 'openTasksUnticked'
  | 'openTasksPagination'
  | 'openTasksPage'
  | 'openTasksPrevious'
  | 'openTasksNext';

export const openTasksTranslations: Record<Language, Record<OpenTasksTranslationKey, string>> = {
  en: {
    openTasksNav: 'Tasks',
    openTasksTitle: 'Open tasks',
    openTasksIntro: 'Every task still to do in your Markdown entries, newest first. Tick one off here and its entry is ticked too.',
    openTasksLoading: 'Loading your open tasks…',
    openTasksLoadError: 'Your open tasks could not be loaded.',
    openTasksRetry: 'Try again',
    openTasksEmpty: 'Nothing left to do. Write “- [ ] something to do” in a Markdown entry and it shows up here.',
    openTasksEmptyDiary: 'Nothing left to do in this diary. Write “- [ ] something to do” in a Markdown entry and it shows up here.',
    openTasksCount_one: '{count} open task',
    openTasksCount_other: '{count} open tasks',
    openTasksOpenEntry: 'Open the entry',
    openTasksOpenEntryOf: 'Open the entry of {date}',
    openTasksTicked: 'Ticked off: {task}',
    openTasksUnticked: 'Back on the list: {task}',
    openTasksPagination: 'Open task pages',
    openTasksPage: 'Page {page} of {total}',
    openTasksPrevious: 'Previous',
    openTasksNext: 'Next',
  },
  fr: {
    openTasksNav: 'Tâches',
    openTasksTitle: 'Tâches à faire',
    openTasksIntro: 'Toutes les tâches encore à faire de vos entrées Markdown, les plus récentes d’abord. Cochez-en une ici et elle est cochée dans son entrée aussi.',
    openTasksLoading: 'Chargement de vos tâches à faire…',
    openTasksLoadError: 'Impossible de charger vos tâches à faire.',
    openTasksRetry: 'Réessayer',
    openTasksEmpty: 'Plus rien à faire. Écrivez « - [ ] une chose à faire » dans une entrée Markdown et elle apparaîtra ici.',
    openTasksEmptyDiary: 'Plus rien à faire dans ce journal. Écrivez « - [ ] une chose à faire » dans une entrée Markdown et elle apparaîtra ici.',
    openTasksCount_one: '{count} tâche à faire',
    openTasksCount_other: '{count} tâches à faire',
    openTasksOpenEntry: 'Ouvrir l’entrée',
    openTasksOpenEntryOf: 'Ouvrir l’entrée du {date}',
    openTasksTicked: 'Cochée : {task}',
    openTasksUnticked: 'De nouveau à faire : {task}',
    openTasksPagination: 'Pages des tâches à faire',
    openTasksPage: 'Page {page} sur {total}',
    openTasksPrevious: 'Précédente',
    openTasksNext: 'Suivante',
  },
};

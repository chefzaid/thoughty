import type { Language } from './translations';

export type RecycleBinTranslationKey =
  | 'recycleBin'
  | 'recycleBinOpenHint'
  | 'recycleBinTitle'
  | 'recycleBinIntro'
  | 'recycleBinBack'
  | 'recycleBinRestoreAll'
  | 'recycleBinEmpty'
  | 'recycleBinLoading'
  | 'recycleBinLoadError'
  | 'recycleBinRetry'
  | 'recycleBinEmptyState'
  | 'recycleBinCount'
  | 'recycleBinEntries_one'
  | 'recycleBinEntries_other'
  | 'recycleBinDaysLeft_one'
  | 'recycleBinDaysLeft_other'
  | 'recycleBinPurgeToday'
  | 'recycleBinFiles_one'
  | 'recycleBinFiles_other'
  | 'recycleBinDeletedOn'
  | 'recycleBinReturnsTo'
  | 'recycleBinReturnsToDefault'
  | 'recycleBinDefaultDiary'
  | 'recycleBinRestore'
  | 'recycleBinRestoreEntry'
  | 'recycleBinDeleteForever'
  | 'recycleBinDeleteEntry'
  | 'recycleBinDeleteTitle'
  | 'recycleBinDeleteMessage'
  | 'recycleBinEmptyTitle'
  | 'recycleBinEmptyMessage'
  | 'recycleBinRestored'
  | 'recycleBinMovedToDefault'
  | 'recycleBinDeleted'
  | 'recycleBinActionError'
  | 'recycleBinPagination'
  | 'recycleBinPage'
  | 'recycleBinPrevious'
  | 'recycleBinNext';

export const recycleBinTranslations: Record<Language, Record<RecycleBinTranslationKey, string>> = {
  en: {
    recycleBin: 'Recycle bin',
    recycleBinOpenHint: 'Restore or remove deleted entries',
    recycleBinTitle: 'Recycle bin',
    recycleBinIntro: 'Deleted entries stay here for {days} days with their history and files. After that they are removed for good.',
    recycleBinBack: 'Back to journal',
    recycleBinRestoreAll: 'Restore all',
    recycleBinEmpty: 'Empty recycle bin',
    recycleBinLoading: 'Opening the recycle bin…',
    recycleBinLoadError: 'The recycle bin could not be loaded.',
    recycleBinRetry: 'Try again',
    recycleBinEmptyState: 'The recycle bin is empty. Entries you delete wait here for {days} days.',
    recycleBinCount: '{entries} in the recycle bin',
    recycleBinEntries_one: '{count} entry',
    recycleBinEntries_other: '{count} entries',
    recycleBinDaysLeft_one: 'Removed for good in {count} day',
    recycleBinDaysLeft_other: 'Removed for good in {count} days',
    recycleBinPurgeToday: 'Removed for good today',
    recycleBinFiles_one: '{count} file',
    recycleBinFiles_other: '{count} files',
    recycleBinDeletedOn: 'Deleted {date}',
    recycleBinReturnsTo: 'Returns to {diary}',
    recycleBinReturnsToDefault: 'Its diary was deleted, so it returns to {diary}',
    recycleBinDefaultDiary: 'your default diary',
    recycleBinRestore: 'Restore',
    recycleBinRestoreEntry: 'Restore the entry of {date}',
    recycleBinDeleteForever: 'Delete forever',
    recycleBinDeleteEntry: 'Delete the entry of {date} forever',
    recycleBinDeleteTitle: 'Delete forever?',
    recycleBinDeleteMessage: 'The entry of {date} will be deleted with its history and files. This cannot be undone.',
    recycleBinEmptyTitle: 'Empty the recycle bin?',
    recycleBinEmptyMessage: '{entries} will be deleted with their history and files. This cannot be undone.',
    recycleBinRestored: '{entries} back in your journal.',
    recycleBinMovedToDefault: '{entries} went to {diary} because the diary they came from no longer exists.',
    recycleBinDeleted: '{entries} deleted for good.',
    recycleBinActionError: 'That did not work. Please try again.',
    recycleBinPagination: 'Recycle bin pages',
    recycleBinPage: 'Page {page} of {total}',
    recycleBinPrevious: 'Previous',
    recycleBinNext: 'Next',
  },
  fr: {
    recycleBin: 'Corbeille',
    recycleBinOpenHint: 'Restaurer ou supprimer les entrées effacées',
    recycleBinTitle: 'Corbeille',
    recycleBinIntro: 'Les entrées supprimées restent ici {days} jours avec leur historique et leurs fichiers. Ensuite, elles sont supprimées définitivement.',
    recycleBinBack: 'Retour au journal',
    recycleBinRestoreAll: 'Tout restaurer',
    recycleBinEmpty: 'Vider la corbeille',
    recycleBinLoading: 'Ouverture de la corbeille…',
    recycleBinLoadError: 'La corbeille n’a pas pu être chargée.',
    recycleBinRetry: 'Réessayer',
    recycleBinEmptyState: 'La corbeille est vide. Les entrées que vous supprimez y restent {days} jours.',
    recycleBinCount: '{entries} dans la corbeille',
    recycleBinEntries_one: '{count} entrée',
    recycleBinEntries_other: '{count} entrées',
    recycleBinDaysLeft_one: 'Supprimée définitivement dans {count} jour',
    recycleBinDaysLeft_other: 'Supprimée définitivement dans {count} jours',
    recycleBinPurgeToday: 'Supprimée définitivement aujourd’hui',
    recycleBinFiles_one: '{count} fichier',
    recycleBinFiles_other: '{count} fichiers',
    recycleBinDeletedOn: 'Supprimée le {date}',
    recycleBinReturnsTo: 'Retournera dans {diary}',
    recycleBinReturnsToDefault: 'Son journal a été supprimé : elle retournera dans {diary}',
    recycleBinDefaultDiary: 'votre journal par défaut',
    recycleBinRestore: 'Restaurer',
    recycleBinRestoreEntry: 'Restaurer l’entrée du {date}',
    recycleBinDeleteForever: 'Supprimer définitivement',
    recycleBinDeleteEntry: 'Supprimer définitivement l’entrée du {date}',
    recycleBinDeleteTitle: 'Supprimer définitivement ?',
    recycleBinDeleteMessage: 'L’entrée du {date} sera supprimée avec son historique et ses fichiers. Cette action est irréversible.',
    recycleBinEmptyTitle: 'Vider la corbeille ?',
    recycleBinEmptyMessage: '{entries} seront supprimées avec leur historique et leurs fichiers. Cette action est irréversible.',
    recycleBinRestored: '{entries} de retour dans votre journal.',
    recycleBinMovedToDefault: '{entries} dans {diary}, car leur journal d’origine n’existe plus.',
    recycleBinDeleted: '{entries} supprimées définitivement.',
    recycleBinActionError: 'L’opération a échoué. Veuillez réessayer.',
    recycleBinPagination: 'Pages de la corbeille',
    recycleBinPage: 'Page {page} sur {total}',
    recycleBinPrevious: 'Précédente',
    recycleBinNext: 'Suivante',
  },
};

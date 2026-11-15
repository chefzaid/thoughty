import type { Language } from './translations';

/** The journal's infinite scroll: loading more entries either way, its announcements and the bulk selection of what is loaded. */
export type JournalFeedTranslationKey =
  | 'journalFeedLabel'
  | 'loadNewerEntries'
  | 'loadingMoreEntries'
  | 'journalFeedEnd'
  | 'journalFeedLoadError'
  | 'journalFeedLoaded_one'
  | 'journalFeedLoaded_other'
  | 'journalFeedHint'
  | 'selectAllLoaded_one'
  | 'selectAllLoaded_other';

export const journalFeedTranslations: Record<Language, Record<JournalFeedTranslationKey, string>> = {
  en: {
    journalFeedLabel: 'Journal entries',
    loadNewerEntries: 'Show newer entries',
    loadingMoreEntries: 'Loading more entries…',
    journalFeedEnd: 'No more entries to load.',
    journalFeedLoadError: 'The entries could not be loaded.',
    journalFeedLoaded_one: '{count} more entry loaded, {shown} of {total} shown.',
    journalFeedLoaded_other: '{count} more entries loaded, {shown} of {total} shown.',
    journalFeedHint: 'Left and right arrows move to the previous and next entry; more entries load at either end.',
    selectAllLoaded_one: 'Select the {count} loaded entry ({total} match)',
    selectAllLoaded_other: 'Select the {count} loaded entries ({total} match)',
  },
  fr: {
    journalFeedLabel: 'Entrées du journal',
    loadNewerEntries: 'Afficher les entrées plus récentes',
    loadingMoreEntries: 'Chargement d’autres entrées…',
    journalFeedEnd: 'Aucune autre entrée à charger.',
    journalFeedLoadError: 'Impossible de charger les entrées.',
    journalFeedLoaded_one: '{count} entrée de plus chargée, {shown} sur {total} affichées.',
    journalFeedLoaded_other: '{count} entrées de plus chargées, {shown} sur {total} affichées.',
    journalFeedHint: 'Les flèches gauche et droite passent à l’entrée précédente et suivante ; d’autres entrées se chargent à chaque bout.',
    selectAllLoaded_one: 'Sélectionner l’entrée chargée ({total} correspondent)',
    selectAllLoaded_other: 'Sélectionner les {count} entrées chargées ({total} correspondent)',
  },
};

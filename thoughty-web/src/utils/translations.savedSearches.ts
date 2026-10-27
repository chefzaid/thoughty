import type { Language } from './translations';

/** Saved searches: named journal filter combinations in the filter bar. */
export type SavedSearchesTranslationKey =
  | 'savedSearches'
  | 'savedSearchesShowing'
  | 'savedSearchesIntro'
  | 'savedSearchName'
  | 'savedSearchSaveCurrent'
  | 'savedSearchWillSave'
  | 'savedSearchCount'
  | 'savedSearchLimitReached'
  | 'savedSearchesEmpty'
  | 'savedSearchesLoading'
  | 'savedSearchesLoadFailed'
  | 'savedSearchShowingBadge'
  | 'savedSearchRename'
  | 'savedSearchNewName'
  | 'savedSearchRenameSave'
  | 'savedSearchDelete'
  | 'savedSearchDeleteTitle'
  | 'savedSearchDeleteMessage'
  | 'savedSearchSaved'
  | 'savedSearchRenamed'
  | 'savedSearchDeleted'
  | 'savedSearchMissing'
  | 'savedSearchNameRequired'
  | 'savedSearchSaveFailed'
  | 'savedSearchRenameFailed'
  | 'savedSearchDeleteFailed'
  | 'savedSearchText'
  | 'savedSearchMeaning'
  | 'savedSearchActiveAndArchived'
  | 'savedSearchNoFilters';

export const savedSearchesTranslations: Record<Language, Record<SavedSearchesTranslationKey, string>> = {
  en: {
    savedSearches: 'Saved searches',
    savedSearchesShowing: 'Saved searches: {name}',
    savedSearchesIntro: 'Keep the current search, filters and diary under a name, then come back to them in one click.',
    savedSearchName: 'Name',
    savedSearchSaveCurrent: 'Save current filters',
    savedSearchWillSave: 'Saves: {summary}',
    savedSearchCount: '{count} of {limit} saved',
    savedSearchLimitReached: 'You have reached the limit of {limit} saved searches. Delete one to save another.',
    savedSearchesEmpty: 'No saved searches yet. Set the filters you want, name them and save.',
    savedSearchesLoading: 'Loading saved searches…',
    savedSearchesLoadFailed: 'Saved searches could not be loaded.',
    savedSearchShowingBadge: 'Showing',
    savedSearchRename: 'Rename {name}',
    savedSearchNewName: 'New name for {name}',
    savedSearchRenameSave: 'Save name',
    savedSearchDelete: 'Delete {name}',
    savedSearchDeleteTitle: 'Delete saved search?',
    savedSearchDeleteMessage: '“{name}” will be removed from your saved searches. Your entries stay as they are.',
    savedSearchSaved: 'Saved “{name}”.',
    savedSearchRenamed: 'Renamed to “{name}”.',
    savedSearchDeleted: 'Deleted “{name}”.',
    savedSearchMissing: 'That saved search no longer exists. The journal shows your current filters instead.',
    savedSearchNameRequired: 'Enter a name for this search.',
    savedSearchSaveFailed: 'The search could not be saved. Try again.',
    savedSearchRenameFailed: 'The search could not be renamed. Try again.',
    savedSearchDeleteFailed: 'The search could not be deleted. Try again.',
    savedSearchText: '“{search}”',
    savedSearchMeaning: 'Meaning: “{search}”',
    savedSearchActiveAndArchived: 'Active and archived',
    savedSearchNoFilters: 'No filters',
  },
  fr: {
    savedSearches: 'Recherches enregistrées',
    savedSearchesShowing: 'Recherches enregistrées : {name}',
    savedSearchesIntro: 'Gardez la recherche, les filtres et le journal actuels sous un nom, puis retrouvez-les en un clic.',
    savedSearchName: 'Nom',
    savedSearchSaveCurrent: 'Enregistrer les filtres actuels',
    savedSearchWillSave: 'Enregistre : {summary}',
    savedSearchCount: '{count} sur {limit} enregistrées',
    savedSearchLimitReached: 'Vous avez atteint la limite de {limit} recherches enregistrées. Supprimez-en une pour en ajouter une autre.',
    savedSearchesEmpty: 'Aucune recherche enregistrée. Choisissez vos filtres, donnez-leur un nom et enregistrez.',
    savedSearchesLoading: 'Chargement des recherches enregistrées…',
    savedSearchesLoadFailed: 'Les recherches enregistrées n’ont pas pu être chargées.',
    savedSearchShowingBadge: 'Affichée',
    savedSearchRename: 'Renommer {name}',
    savedSearchNewName: 'Nouveau nom pour {name}',
    savedSearchRenameSave: 'Enregistrer le nom',
    savedSearchDelete: 'Supprimer {name}',
    savedSearchDeleteTitle: 'Supprimer la recherche enregistrée ?',
    savedSearchDeleteMessage: '« {name} » sera retirée de vos recherches enregistrées. Vos entrées ne changent pas.',
    savedSearchSaved: '« {name} » enregistrée.',
    savedSearchRenamed: 'Renommée en « {name} ».',
    savedSearchDeleted: '« {name} » supprimée.',
    savedSearchMissing: 'Cette recherche enregistrée n’existe plus. Le journal affiche vos filtres actuels.',
    savedSearchNameRequired: 'Donnez un nom à cette recherche.',
    savedSearchSaveFailed: 'La recherche n’a pas pu être enregistrée. Réessayez.',
    savedSearchRenameFailed: 'La recherche n’a pas pu être renommée. Réessayez.',
    savedSearchDeleteFailed: 'La recherche n’a pas pu être supprimée. Réessayez.',
    savedSearchText: '« {search} »',
    savedSearchMeaning: 'Sens : « {search} »',
    savedSearchActiveAndArchived: 'Actives et archivées',
    savedSearchNoFilters: 'Aucun filtre',
  },
};

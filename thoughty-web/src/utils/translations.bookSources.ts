import type { Language } from './translations';

/** Where a book's entries come from: the journal, a saved search or hand-picked entries, and the journal's Make a book action. */
export type BookSourcesTranslationKey =
  | "bookSourceLabel"
  | "bookSourceJournal"
  | "bookSourceSavedSearch"
  | "bookSourceEntries"
  | "bookSavedSearchLabel"
  | "bookSavedSearchPlaceholder"
  | "bookSavedSearchSemantic"
  | "bookSavedSearchEmpty"
  | "bookSavedSearchHint"
  | "bookPickedCount_one"
  | "bookPickedCount_other"
  | "bookPickedEmpty"
  | "bookPickedHint"
  | "bookPickedLoading"
  | "bookPickedLoadError"
  | "bookPickedRemove"
  | "bookPickedClear"
  | "bookPickedMissing"
  | "bookPickedMissingEntry"
  | "bookTitlePlaceholderSavedSearch"
  | "bookTitlePlaceholderEntries"
  | "bookChapterModeSingle"
  | "bookVersionSourceJournal"
  | "bookVersionSourceSavedSearch"
  | "bookVersionSourceEntries_one"
  | "bookVersionSourceEntries_other"
  | "bookVersionUseEntries"
  | "bookVersionUseEntriesLabel"
  | "bulkMakeBook";

export const bookSourcesTranslations: Record<Language, Record<BookSourcesTranslationKey, string>> = {
  en: {
    bookSourceLabel: "Entries from",
    bookSourceJournal: "This journal ({diaryName})",
    bookSourceSavedSearch: "A saved search",
    bookSourceEntries: "Hand-picked entries",
    bookSavedSearchLabel: "Saved search",
    bookSavedSearchPlaceholder: "Choose a saved search",
    bookSavedSearchSemantic: "{name} (meaning search, not available)",
    bookSavedSearchEmpty:
      "You have no saved searches yet. Save a search in the journal to build a book from it.",
    bookSavedSearchHint:
      "The book takes the entries this search finds when it is made, so a new version adds what the search has found since.",
    bookPickedCount_one: "{count} entry picked",
    bookPickedCount_other: "{count} entries picked",
    bookPickedEmpty:
      "No entries picked yet. In the journal, select entries and choose Make a book.",
    bookPickedHint:
      "Remove what does not belong. To add entries, select them in the journal and choose Make a book again.",
    bookPickedLoading: "Loading the picked entries...",
    bookPickedLoadError: "Failed to load the picked entries",
    bookPickedRemove: "Remove {entry} from the book",
    bookPickedClear: "Clear all",
    bookPickedMissing: "No longer available (deleted or in the recycle bin)",
    bookPickedMissingEntry: "Entry #{id}",
    bookTitlePlaceholderSavedSearch: "Defaults to the saved search name",
    bookTitlePlaceholderEntries: "Give your book a title",
    bookChapterModeSingle: "One chapter",
    bookVersionSourceJournal: "From the journal",
    bookVersionSourceSavedSearch: "From the saved search {name}",
    bookVersionSourceEntries_one: "{count} hand-picked entry",
    bookVersionSourceEntries_other: "{count} hand-picked entries",
    bookVersionUseEntries: "Use these entries",
    bookVersionUseEntriesLabel: "Use the entries of version {version}",
    bulkMakeBook: "Make a book",
  },
  fr: {
    bookSourceLabel: "Entrées issues de",
    bookSourceJournal: "Ce journal ({diaryName})",
    bookSourceSavedSearch: "Une recherche enregistrée",
    bookSourceEntries: "Entrées choisies",
    bookSavedSearchLabel: "Recherche enregistrée",
    bookSavedSearchPlaceholder: "Choisissez une recherche enregistrée",
    bookSavedSearchSemantic: "{name} (recherche par le sens, indisponible)",
    bookSavedSearchEmpty:
      "Vous n'avez encore aucune recherche enregistrée. Enregistrez une recherche dans le journal pour en faire un livre.",
    bookSavedSearchHint:
      "Le livre reprend les entrées que cette recherche trouve au moment où il est créé : une nouvelle version ajoute ce qu'elle a trouvé depuis.",
    bookPickedCount_one: "{count} entrée choisie",
    bookPickedCount_other: "{count} entrées choisies",
    bookPickedEmpty:
      "Aucune entrée choisie. Dans le journal, sélectionnez des entrées puis choisissez Faire un livre.",
    bookPickedHint:
      "Retirez ce qui n'a pas sa place. Pour ajouter des entrées, sélectionnez-les dans le journal et choisissez à nouveau Faire un livre.",
    bookPickedLoading: "Chargement des entrées choisies...",
    bookPickedLoadError: "Échec du chargement des entrées choisies",
    bookPickedRemove: "Retirer {entry} du livre",
    bookPickedClear: "Tout retirer",
    bookPickedMissing: "N'est plus disponible (supprimée ou dans la corbeille)",
    bookPickedMissingEntry: "Entrée n° {id}",
    bookTitlePlaceholderSavedSearch: "Par défaut : le nom de la recherche enregistrée",
    bookTitlePlaceholderEntries: "Donnez un titre à votre livre",
    bookChapterModeSingle: "Un seul chapitre",
    bookVersionSourceJournal: "Depuis le journal",
    bookVersionSourceSavedSearch: "Depuis la recherche enregistrée {name}",
    bookVersionSourceEntries_one: "{count} entrée choisie",
    bookVersionSourceEntries_other: "{count} entrées choisies",
    bookVersionUseEntries: "Reprendre ces entrées",
    bookVersionUseEntriesLabel: "Reprendre les entrées de la version {version}",
    bulkMakeBook: "Faire un livre",
  },
};

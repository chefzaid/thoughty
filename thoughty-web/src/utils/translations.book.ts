import type { Language } from './translations';

/** The book converter: options, cover, preview, cloud upload and saved versions. */
export type BookTranslationKey =
  | "book"
  | "bookDescription"
  | "bookTitleLabel"
  | "bookTitlePlaceholder"
  | "bookAuthorLabel"
  | "bookAuthorPlaceholder"
  | "bookFormatLabel"
  | "bookFormatPdf"
  | "bookFormatEpub"
  | "bookFormatHtml"
  | "bookChapterOrder"
  | "bookChapterMode"
  | "bookChapterModeTags"
  | "bookChapterModeYear"
  | "bookChapterModeMonth"
  | "chapterOrderAlpha"
  | "chapterOrderEntries"
  | "chapterOrderChrono"
  | "bookTagScope"
  | "tagScopeAll"
  | "tagScopeFirst"
  | "bookWeavingMode"
  | "bookWeavingStrict"
  | "bookWeavingCreative"
  | "bookIncludeUntagged"
  | "bookIncludeDates"
  | "bookIncludeToc"
  | "bookNarrative"
  | "bookChapterFraming"
  | "bookEmbedImages"
  | "bookCover"
  | "bookCoverTheme"
  | "bookCoverThemeClassic"
  | "bookCoverThemeOcean"
  | "bookCoverThemeForest"
  | "bookCoverThemeRose"
  | "bookCoverChooseImage"
  | "bookCoverReplaceImage"
  | "bookCoverRemoveImage"
  | "bookCoverPreview"
  | "bookCoverImageInvalid"
  | "previewBook"
  | "downloadBook"
  | "generatingBook"
  | "bookOutline"
  | "bookChaptersCount"
  | "bookEntriesCount"
  | "bookNoChapters"
  | "bookPreviewError"
  | "bookExportSuccess"
  | "bookExportError"
  | "bookCloudProvider"
  | "bookCloudProviderPlaceholder"
  | "bookCloudConnectHint"
  | "uploadBook"
  | "uploadingBook"
  | "bookCloudUploadSuccess"
  | "bookCloudUploadError"
  | "createBookVersion"
  | "updateBookVersion"
  | "savingBookVersion"
  | "bookVersionHistory"
  | "bookVersionEmpty"
  | "bookVersionNumber"
  | "bookVersionCounts"
  | "bookVersionChapters_one"
  | "bookVersionChapters_other"
  | "bookVersionEntries_one"
  | "bookVersionEntries_other"
  | "bookVersionChanges"
  | "bookVersionNewEntries_one"
  | "bookVersionNewEntries_other"
  | "bookVersionNewChapters_one"
  | "bookVersionNewChapters_other"
  | "bookVersionSaved"
  | "bookVersionSaveError"
  | "downloadBookVersion"
  | "bookVersionDownloadError";

export const bookTranslations: Record<Language, Record<BookTranslationKey, string>> = {
  en: {
    book: "Book",
    bookDescription:
      "Turn the entries of {diaryName} into a book: each tag becomes a chapter, and AI weaves its thoughts into flowing prose without adding anything that is not yours.",
    bookTitleLabel: "Title",
    bookTitlePlaceholder: "Defaults to the diary name",
    bookAuthorLabel: "Author",
    bookAuthorPlaceholder: "Defaults to your username",
    bookFormatLabel: "Book format",
    bookFormatPdf: "PDF (.pdf)",
    bookFormatEpub: "EPUB (.epub)",
    bookFormatHtml: "HTML (.html)",
    bookChapterOrder: "Chapter order",
    bookChapterMode: "Chapter type",
    bookChapterModeTags: "By tag",
    bookChapterModeYear: "By year",
    bookChapterModeMonth: "By month",
    chapterOrderAlpha: "Alphabetical",
    chapterOrderEntries: "Most entries first",
    chapterOrderChrono: "By first entry date",
    bookTagScope: "Entries with several tags",
    tagScopeAll: "Appear in every tag chapter",
    tagScopeFirst: "Appear in their first tag chapter only",
    bookWeavingMode: "AI weaving mode",
    bookWeavingStrict: "Strict to entries",
    bookWeavingCreative: "Creative transitions",
    bookIncludeUntagged: "Add a chapter for untagged entries",
    bookIncludeDates: "Show entry dates",
    bookIncludeToc: "Include table of contents",
    bookNarrative: "Weave thoughts into flowing prose with AI",
    bookChapterFraming: "Add AI chapter introductions and summaries",
    bookEmbedImages: "Include image attachments",
    bookCover: "Cover",
    bookCoverTheme: "Cover color theme",
    bookCoverThemeClassic: "Classic",
    bookCoverThemeOcean: "Ocean",
    bookCoverThemeForest: "Forest",
    bookCoverThemeRose: "Rose",
    bookCoverChooseImage: "Choose cover image",
    bookCoverReplaceImage: "Replace cover image",
    bookCoverRemoveImage: "Remove cover image",
    bookCoverPreview: "Cover image preview",
    bookCoverImageInvalid: "Choose a PNG or JPEG image no larger than 2 MB.",
    previewBook: "Preview Chapters",
    downloadBook: "Download Book",
    generatingBook: "Generating...",
    bookOutline: "Book Outline",
    bookChaptersCount: "chapters",
    bookEntriesCount: "entries",
    bookNoChapters:
      "No chapters could be built. Add tags to your entries to create chapters.",
    bookPreviewError: "Failed to preview book",
    bookExportSuccess: "Book downloaded successfully",
    bookExportError: "Failed to generate book",
    bookCloudProvider: "Cloud destination",
    bookCloudProviderPlaceholder: "No connected provider",
    bookCloudConnectHint:
      "Connect a cloud provider in your profile to upload books.",
    uploadBook: "Upload Book",
    uploadingBook: "Uploading book...",
    bookCloudUploadSuccess: "Uploaded {name} successfully",
    bookCloudUploadError: "Failed to upload book",
    createBookVersion: "Save First Version",
    updateBookVersion: "Create New Version",
    savingBookVersion: "Saving book version...",
    bookVersionHistory: "Version History",
    bookVersionEmpty:
      "Save a version to preserve this book and track future updates.",
    bookVersionNumber: "Version {version}",
    bookVersionCounts: "{chapters} · {entries}",
    bookVersionChapters_one: "{count} chapter",
    bookVersionChapters_other: "{count} chapters",
    bookVersionEntries_one: "{count} entry",
    bookVersionEntries_other: "{count} entries",
    bookVersionChanges: "{entries} · {chapters}",
    bookVersionNewEntries_one: "{count} new entry",
    bookVersionNewEntries_other: "{count} new entries",
    bookVersionNewChapters_one: "{count} new chapter",
    bookVersionNewChapters_other: "{count} new chapters",
    bookVersionSaved: "Book version {version} saved",
    bookVersionSaveError: "Failed to save book version",
    downloadBookVersion: "Download version {version}",
    bookVersionDownloadError: "Failed to download book version",
  },
  fr: {
    book: "Livre",
    bookDescription:
      "Transformez les entrées de {diaryName} en livre : chaque tag devient un chapitre, et l'IA tisse ses pensées en prose fluide sans rien ajouter qui ne vienne de vous.",
    bookTitleLabel: "Titre",
    bookTitlePlaceholder: "Par défaut : le nom du journal",
    bookAuthorLabel: "Auteur",
    bookAuthorPlaceholder: "Par défaut : votre nom d'utilisateur",
    bookFormatLabel: "Format du livre",
    bookFormatPdf: "PDF (.pdf)",
    bookFormatEpub: "EPUB (.epub)",
    bookFormatHtml: "HTML (.html)",
    bookChapterOrder: "Ordre des chapitres",
    bookChapterMode: "Type de chapitre",
    bookChapterModeTags: "Par tag",
    bookChapterModeYear: "Par année",
    bookChapterModeMonth: "Par mois",
    chapterOrderAlpha: "Alphabétique",
    chapterOrderEntries: "Par nombre d'entrées",
    chapterOrderChrono: "Par date de première entrée",
    bookTagScope: "Entrées avec plusieurs tags",
    tagScopeAll: "Apparaissent dans chaque chapitre de tag",
    tagScopeFirst: "Apparaissent uniquement dans leur premier chapitre",
    bookWeavingMode: "Mode de tissage IA",
    bookWeavingStrict: "Strictement fidèle aux entrées",
    bookWeavingCreative: "Transitions créatives",
    bookIncludeUntagged: "Ajouter un chapitre pour les entrées sans tag",
    bookIncludeDates: "Afficher les dates des entrées",
    bookIncludeToc: "Inclure la table des matières",
    bookNarrative: "Tisser les pensées en prose fluide avec l'IA",
    bookChapterFraming:
      "Ajouter des introductions et résumés de chapitre par IA",
    bookEmbedImages: "Inclure les images jointes",
    bookCover: "Couverture",
    bookCoverTheme: "Thème coloré de la couverture",
    bookCoverThemeClassic: "Classique",
    bookCoverThemeOcean: "Océan",
    bookCoverThemeForest: "Forêt",
    bookCoverThemeRose: "Rose",
    bookCoverChooseImage: "Choisir une image de couverture",
    bookCoverReplaceImage: "Remplacer l'image de couverture",
    bookCoverRemoveImage: "Supprimer l'image de couverture",
    bookCoverPreview: "Aperçu de l'image de couverture",
    bookCoverImageInvalid: "Choisissez une image PNG ou JPEG de 2 Mo maximum.",
    previewBook: "Aperçu des chapitres",
    downloadBook: "Télécharger le livre",
    generatingBook: "Génération...",
    bookOutline: "Plan du livre",
    bookChaptersCount: "chapitres",
    bookEntriesCount: "entrées",
    bookNoChapters:
      "Aucun chapitre n'a pu être créé. Ajoutez des tags à vos entrées pour créer des chapitres.",
    bookPreviewError: "Échec de l'aperçu du livre",
    bookExportSuccess: "Livre téléchargé avec succès",
    bookExportError: "Échec de la génération du livre",
    bookCloudProvider: "Destination cloud",
    bookCloudProviderPlaceholder: "Aucun fournisseur connecté",
    bookCloudConnectHint:
      "Connectez un fournisseur cloud dans votre profil pour téléverser des livres.",
    uploadBook: "Téléverser le livre",
    uploadingBook: "Téléversement du livre...",
    bookCloudUploadSuccess: "{name} téléversé avec succès",
    bookCloudUploadError: "Échec du téléversement du livre",
    createBookVersion: "Enregistrer la première version",
    updateBookVersion: "Créer une nouvelle version",
    savingBookVersion: "Enregistrement de la version...",
    bookVersionHistory: "Historique des versions",
    bookVersionEmpty:
      "Enregistrez une version pour conserver ce livre et suivre ses futures mises à jour.",
    bookVersionNumber: "Version {version}",
    bookVersionCounts: "{chapters} · {entries}",
    bookVersionChapters_one: "{count} chapitre",
    bookVersionChapters_other: "{count} chapitres",
    bookVersionEntries_one: "{count} entrée",
    bookVersionEntries_other: "{count} entrées",
    bookVersionChanges: "{entries} · {chapters}",
    bookVersionNewEntries_one: "{count} nouvelle entrée",
    bookVersionNewEntries_other: "{count} nouvelles entrées",
    bookVersionNewChapters_one: "{count} nouveau chapitre",
    bookVersionNewChapters_other: "{count} nouveaux chapitres",
    bookVersionSaved: "Version {version} du livre enregistrée",
    bookVersionSaveError: "Échec de l'enregistrement de la version du livre",
    downloadBookVersion: "Télécharger la version {version}",
    bookVersionDownloadError: "Échec du téléchargement de la version du livre",
  },
};

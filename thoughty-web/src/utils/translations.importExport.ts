import type { Language } from './translations';

/** Journal import and export, the export format settings, downloading your data and deleting all entries. */
export type ImportExportTranslationKey =
  | "importExport"
  | "import"
  | "export"
  | "exportDescription"
  | "importDescription"
  | "downloadExport"
  | "includeVisibility"
  | "includeVisibilityShort"
  | "exportFormat"
  | "formatTxt"
  | "formatJson"
  | "formatMd"
  | "formatCsv"
  | "chooseFile"
  | "previewSummary"
  | "entriesFound"
  | "duplicatesFound"
  | "skipDuplicates"
  | "confirmImport"
  | "importing"
  | "importSuccess_one"
  | "importSuccess_other"
  | "importDuplicatesSkipped_one"
  | "importDuplicatesSkipped_other"
  | "importError"
  | "exportSuccess"
  | "exportError"
  | "previewError"
  | "formatSettings"
  | "formatDescription"
  | "entrySeparator"
  | "sameDaySeparator"
  | "datePrefix"
  | "dateSuffix"
  | "dateFormat"
  | "tagOpenBracket"
  | "tagCloseBracket"
  | "tagSeparator"
  | "saveFormat"
  | "formatSaved"
  | "formatSaveError"
  | "dataPrivacy"
  | "downloadMyData"
  | "downloadMyDataDescription"
  | "downloading"
  | "downloadDataError"
  | "dangerZone"
  | "deleteAllDescription"
  | "deleteAllEntries"
  | "confirmDeleteAll"
  | "deleteAllSuccess"
  | "deleteAllError"
  | "deleting";

export const importExportTranslations: Record<Language, Record<ImportExportTranslationKey, string>> = {
  en: {
    importExport: "Import/Export",
    import: "Import",
    export: "Export",
    exportDescription:
      "Download all journal entries from {diaryName} in the format of your choice.",
    importDescription: "Upload a text file to import entries into {diaryName}.",
    downloadExport: "Download",
    includeVisibility: "Include visibility (public/private) in export",
    includeVisibilityShort: "Include visibility",
    exportFormat: "Format",
    formatTxt: "Text (.txt)",
    formatJson: "JSON (.json)",
    formatMd: "Markdown (.md)",
    formatCsv: "CSV (.csv)",
    chooseFile: "Choose File",
    previewSummary: "Preview Summary",
    entriesFound: "entries found",
    duplicatesFound: "duplicates found",
    skipDuplicates: "Skip duplicate entries",
    confirmImport: "Import Entries",
    importing: "Importing...",
    importSuccess_one: "Successfully imported {count} entry ({skipped})",
    importSuccess_other: "Successfully imported {count} entries ({skipped})",
    importDuplicatesSkipped_one: "{count} duplicate skipped",
    importDuplicatesSkipped_other: "{count} duplicates skipped",
    importError: "Failed to import entries",
    exportSuccess: "Export downloaded successfully",
    exportError: "Failed to export entries",
    previewError: "Failed to preview file",
    formatSettings: "Format Settings",
    formatDescription: "Customize the text file format for import and export.",
    entrySeparator: "Entry Separator",
    sameDaySeparator: "Same Day Separator",
    datePrefix: "Date Prefix",
    dateSuffix: "Date Suffix",
    dateFormat: "Date Format",
    tagOpenBracket: "Tag Open Bracket",
    tagCloseBracket: "Tag Close Bracket",
    tagSeparator: "Tag Separator",
    saveFormat: "Save Format Settings",
    formatSaved: "Format settings saved",
    formatSaveError: "Failed to save format settings",
    dataPrivacy: "Privacy",
    downloadMyData: "Download My Data",
    downloadMyDataDescription: "Download all your data as a JSON file (GDPR)",
    downloading: "Downloading...",
    downloadDataError: "Failed to download data. Please try again.",
    dangerZone: "Danger Zone",
    deleteAllDescription:
      "Move all entries from {diaryName} to the recycle bin. You can restore them from there for 30 days, then they are removed for good.",
    deleteAllEntries: "Delete All Entries",
    confirmDeleteAll: "Yes, Delete Everything",
    deleteAllSuccess: "All entries were moved to the recycle bin for 30 days",
    deleteAllError: "Failed to delete entries",
    deleting: "Deleting...",
  },
  fr: {
    importExport: "Import/Export",
    import: "Importer",
    export: "Exporter",
    exportDescription:
      "Téléchargez toutes les entrées de {diaryName} au format de votre choix.",
    importDescription:
      "Téléversez un fichier texte pour importer des entrées dans {diaryName}.",
    downloadExport: "Télécharger",
    includeVisibility: "Inclure la visibilité (public/privé) dans l'export",
    includeVisibilityShort: "Inclure la visibilité",
    exportFormat: "Format",
    formatTxt: "Texte (.txt)",
    formatJson: "JSON (.json)",
    formatMd: "Markdown (.md)",
    formatCsv: "CSV (.csv)",
    chooseFile: "Choisir un fichier",
    previewSummary: "Aperçu",
    entriesFound: "entrées trouvées",
    duplicatesFound: "doublons trouvés",
    skipDuplicates: "Ignorer les entrées en double",
    confirmImport: "Importer les entrées",
    importing: "Importation...",
    importSuccess_one: "{count} entrée importée avec succès ({skipped})",
    importSuccess_other: "{count} entrées importées avec succès ({skipped})",
    importDuplicatesSkipped_one: "{count} doublon ignoré",
    importDuplicatesSkipped_other: "{count} doublons ignorés",
    importError: "Échec de l'importation des entrées",
    exportSuccess: "Export téléchargé avec succès",
    exportError: "Échec de l'exportation des entrées",
    previewError: "Échec de l'aperçu du fichier",
    formatSettings: "Paramètres de format",
    formatDescription:
      "Personnalisez le format du fichier texte pour l'import et l'export.",
    entrySeparator: "Séparateur d'entrées",
    sameDaySeparator: "Séparateur du même jour",
    datePrefix: "Préfixe de date",
    dateSuffix: "Suffixe de date",
    dateFormat: "Format de date",
    tagOpenBracket: "Crochet ouvrant de tag",
    tagCloseBracket: "Crochet fermant de tag",
    tagSeparator: "Séparateur de tags",
    saveFormat: "Enregistrer les paramètres",
    formatSaved: "Paramètres de format enregistrés",
    formatSaveError: "Échec de l'enregistrement des paramètres",
    dataPrivacy: "Confidentialité",
    downloadMyData: "Télécharger mes données",
    downloadMyDataDescription:
      "Téléchargez toutes vos données au format JSON (RGPD)",
    downloading: "Téléchargement...",
    downloadDataError: "Échec du téléchargement. Veuillez réessayer.",
    dangerZone: "Zone de danger",
    deleteAllDescription:
      "Placer toutes les entrées de {diaryName} dans la corbeille. Vous pourrez les y restaurer pendant 30 jours, puis elles seront supprimées définitivement.",
    deleteAllEntries: "Supprimer toutes les entrées",
    confirmDeleteAll: "Oui, tout supprimer",
    deleteAllSuccess: "Toutes les entrées sont dans la corbeille pour 30 jours",
    deleteAllError: "Échec de la suppression des entrées",
    deleting: "Suppression...",
  },
};

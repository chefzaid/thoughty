import type { Language } from './translations';

export type AppImportTranslationKey =
  | 'appImportTitle'
  | 'appImportDescription'
  | 'appImportChoose'
  | 'appImportReading'
  | 'appImportUnsupported'
  | 'appImportReadError'
  | 'appImportFoundFrom'
  | 'appImportStatEntries'
  | 'appImportStatJournals'
  | 'appImportStatMedia'
  | 'appImportStatSkipped'
  | 'appImportRange'
  | 'appImportDestination'
  | 'appImportIntoDiary'
  | 'appImportDefaultDiary'
  | 'appImportJournalsAsDiaries'
  | 'appImportPrivacyNote'
  | 'appImportStart'
  | 'appImportProgressEntries'
  | 'appImportProgressFiles'
  | 'appImportWaiting'
  | 'appImportKeepOpen'
  | 'appImportStop'
  | 'appImportDone'
  | 'appImportStopped'
  | 'appImportFailed'
  | 'appImportResultImported'
  | 'appImportResultAlready'
  | 'appImportResultAttached'
  | 'appImportCreatedDiaries'
  | 'appImportFailedFiles'
  | 'appImportReasonTooLarge'
  | 'appImportReasonUnreadable'
  | 'appImportReasonRejected'
  | 'appImportMoreFailed_one'
  | 'appImportMoreFailed_other'
  | 'appImportAnother'
  | 'formatMarkdownFolder';

export const appImportTranslations: Record<Language, Record<AppImportTranslationKey, string>> = {
  en: {
    appImportTitle: 'From Day One or Journey',
    appImportDescription:
      'Bring your journal over from another app, with its photos and recordings. Export it from Day One (JSON, as a .zip) or Journey (ZIP), then choose the file. It is read in your browser; only the entries and their files are sent.',
    appImportChoose: 'Choose an export',
    appImportReading: 'Reading {name}…',
    appImportUnsupported: 'This file is not a Day One or Journey export. Choose the .zip the app created, or the .json file from Day One.',
    appImportReadError: 'The export could not be read. Try exporting it again.',
    appImportFoundFrom: 'Found in your {source} export',
    appImportStatEntries: 'Entries',
    appImportStatJournals: 'Journals',
    appImportStatMedia: 'Photos and recordings',
    appImportStatSkipped: 'Videos and other files left out',
    appImportRange: 'Written from {first} to {last}',
    appImportDestination: 'Where should the entries go?',
    appImportIntoDiary: 'Everything in {diaryName}',
    appImportDefaultDiary: 'your default diary',
    appImportJournalsAsDiaries: 'A diary for each journal: {journals}',
    appImportPrivacyNote: 'Imported entries are private. Importing the same export again later skips what is already here.',
    appImportStart: 'Start the import',
    appImportProgressEntries: 'Importing entries: {done} of {total}',
    appImportProgressFiles: 'Attaching photos and recordings: {done} of {total}',
    appImportWaiting: 'The server asked to slow down; resuming in {seconds} s.',
    appImportKeepOpen: 'Keep this page open until the import finishes.',
    appImportStop: 'Stop',
    appImportDone: 'Import finished',
    appImportStopped: 'Import stopped. Choose the same export again to continue where it stopped.',
    appImportFailed: 'The import stopped: {error}. Choose the same export again to continue where it stopped.',
    appImportResultImported: 'New entries',
    appImportResultAlready: 'Already imported',
    appImportResultAttached: 'Files attached',
    appImportCreatedDiaries: 'New diaries: {names}',
    appImportFailedFiles: 'Files that could not be attached:',
    appImportReasonTooLarge: 'larger than 5 MB',
    appImportReasonUnreadable: 'a format this browser cannot read',
    appImportReasonRejected: 'refused by the server',
    appImportMoreFailed_one: '…and {count} more',
    appImportMoreFailed_other: '…and {count} more',
    appImportAnother: 'Import another export',
    formatMarkdownFolder: 'Markdown folder with attachments (.zip)',
  },
  fr: {
    appImportTitle: 'Depuis Day One ou Journey',
    appImportDescription:
      'Récupérez votre journal tenu dans une autre application, avec ses photos et enregistrements. Exportez-le depuis Day One (JSON, en .zip) ou Journey (ZIP), puis choisissez le fichier. Il est lu dans votre navigateur ; seuls les entrées et leurs fichiers sont envoyés.',
    appImportChoose: 'Choisir un export',
    appImportReading: 'Lecture de {name}…',
    appImportUnsupported: 'Ce fichier n’est pas un export Day One ou Journey. Choisissez le .zip créé par l’application, ou le fichier .json de Day One.',
    appImportReadError: 'L’export n’a pas pu être lu. Essayez de l’exporter à nouveau.',
    appImportFoundFrom: 'Dans votre export {source}',
    appImportStatEntries: 'Entrées',
    appImportStatJournals: 'Journaux',
    appImportStatMedia: 'Photos et enregistrements',
    appImportStatSkipped: 'Vidéos et autres fichiers ignorés',
    appImportRange: 'Écrites du {first} au {last}',
    appImportDestination: 'Où placer les entrées ?',
    appImportIntoDiary: 'Tout dans {diaryName}',
    appImportDefaultDiary: 'votre journal par défaut',
    appImportJournalsAsDiaries: 'Un journal pour chaque journal d’origine : {journals}',
    appImportPrivacyNote: 'Les entrées importées sont privées. Importer à nouveau le même export plus tard ignore ce qui est déjà là.',
    appImportStart: 'Lancer l’import',
    appImportProgressEntries: 'Import des entrées : {done} sur {total}',
    appImportProgressFiles: 'Ajout des photos et enregistrements : {done} sur {total}',
    appImportWaiting: 'Le serveur demande de ralentir ; reprise dans {seconds} s.',
    appImportKeepOpen: 'Gardez cette page ouverte jusqu’à la fin de l’import.',
    appImportStop: 'Arrêter',
    appImportDone: 'Import terminé',
    appImportStopped: 'Import arrêté. Choisissez à nouveau le même export pour reprendre là où il s’est arrêté.',
    appImportFailed: 'L’import s’est interrompu : {error}. Choisissez à nouveau le même export pour reprendre là où il s’est arrêté.',
    appImportResultImported: 'Nouvelles entrées',
    appImportResultAlready: 'Déjà importées',
    appImportResultAttached: 'Fichiers joints',
    appImportCreatedDiaries: 'Nouveaux journaux : {names}',
    appImportFailedFiles: 'Fichiers qui n’ont pas pu être joints :',
    appImportReasonTooLarge: 'plus de 5 Mo',
    appImportReasonUnreadable: 'un format illisible par ce navigateur',
    appImportReasonRejected: 'refusé par le serveur',
    appImportMoreFailed_one: '…et {count} autre',
    appImportMoreFailed_other: '…et {count} autres',
    appImportAnother: 'Importer un autre export',
    formatMarkdownFolder: 'Dossier Markdown avec pièces jointes (.zip)',
  },
};

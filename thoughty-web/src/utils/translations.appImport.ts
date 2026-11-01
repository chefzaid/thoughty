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
  | 'appImportAttachError'
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
  | 'appImportKindLegend'
  | 'appImportKindApps'
  | 'appImportKindDailyNotes'
  | 'appImportDailyNotesDescription'
  | 'appImportNoDailyNotes'
  | 'appImportTooLarge'
  | 'appImportFoundDailyNotes'
  | 'appImportStatSkippedNotes'
  | 'appImportSkippedUndated'
  | 'appImportSkippedEmpty'
  | 'appImportSkippedTooLarge'
  | 'appImportSkippedUnsafe'
  | 'appImportDailyNotesDiary'
  | 'appImportKindKeep'
  | 'appImportKeepDescription'
  | 'appImportNoKeepNotes'
  | 'appImportKeepTooLarge'
  | 'appImportSkippedTrashed'
  | 'appImportSkippedNoDate'
  | 'appImportSkippedUnreadable'
  | 'formatMarkdownFolder';

export const appImportTranslations: Record<Language, Record<AppImportTranslationKey, string>> = {
  en: {
    appImportTitle: 'From another app',
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
    appImportStatSkipped: 'Files left out (missing or of another type)',
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
    appImportAttachError: 'Failed to attach files',
    appImportResultImported: 'New entries',
    appImportResultAlready: 'Already imported',
    appImportResultAttached: 'Files attached',
    appImportCreatedDiaries: 'New diaries: {names}',
    appImportFailedFiles: 'Files that could not be attached:',
    appImportReasonTooLarge: 'over the size limit (50 MB for a video, 5 MB otherwise)',
    appImportReasonUnreadable: 'a format this browser cannot read',
    appImportReasonRejected: 'refused by the server',
    appImportMoreFailed_one: '…and {count} more',
    appImportMoreFailed_other: '…and {count} more',
    appImportAnother: 'Import another export',
    appImportKindLegend: 'What are you importing?',
    appImportKindApps: 'Day One or Journey',
    appImportKindDailyNotes: 'Daily notes (Obsidian, Logseq)',
    appImportDailyNotesDescription:
      'Choose a .zip of your daily notes: the daily notes folder of an Obsidian vault, or the journals folder of a Logseq graph (the whole vault or graph works too). Each note named by its day, such as 2024-03-14.md or 2024_03_14.md, becomes a Markdown entry on that day, with its tags and the pictures it embeds. It is read in your browser; only the entries and their files are sent.',
    appImportNoDailyNotes: 'No daily notes in this file. Choose a .zip holding Markdown notes named by their day, such as 2024-03-14.md or 2024_03_14.md.',
    appImportTooLarge: 'This archive is too large to import at once (over 50,000 files, or over 200 MB of notes). Zip the daily notes folder on its own, or split it into several archives.',
    appImportFoundDailyNotes: 'Found in your daily notes',
    appImportStatSkippedNotes: 'Notes left out',
    appImportSkippedUndated: 'Not named by a day: {count}',
    appImportSkippedEmpty: 'Empty: {count}',
    appImportSkippedTooLarge: 'Over 5 MB: {count}',
    appImportSkippedUnsafe: 'Links, or paths and names that cannot be trusted: {count}',
    appImportDailyNotesDiary: 'The entries go into {diaryName}, the diary chosen for this page.',
    appImportKindKeep: 'Google Keep',
    appImportKeepDescription:
      'Choose the .zip Google Takeout made of your Keep notes (takeout.google.com, with Keep selected). Each note becomes a Markdown entry on the day you created it, with its title, its labels as tags, its checklists as task lists and its pictures. Archived notes stay archived, pinned notes are pinned while your pinned-entry limit allows, and notes in the bin are left out. It is read in your browser; only the entries and their files are sent.',
    appImportNoKeepNotes: 'No Google Keep notes in this file. Choose the .zip Google Takeout made, with its Keep folder.',
    appImportKeepTooLarge: 'This archive is too large to import at once (over 50,000 files, or over 200 MB of notes). Export Keep on its own from Google Takeout, or split the archive.',
    appImportSkippedTrashed: 'In the bin: {count}',
    appImportSkippedNoDate: 'Without a date: {count}',
    appImportSkippedUnreadable: 'Could not be read: {count}',
    formatMarkdownFolder: 'Markdown folder with attachments (.zip)',
  },
  fr: {
    appImportTitle: 'Depuis une autre application',
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
    appImportStatSkipped: 'Fichiers ignorés (manquants ou d’un autre type)',
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
    appImportAttachError: 'Échec de l’ajout des fichiers',
    appImportResultImported: 'Nouvelles entrées',
    appImportResultAlready: 'Déjà importées',
    appImportResultAttached: 'Fichiers joints',
    appImportCreatedDiaries: 'Nouveaux journaux : {names}',
    appImportFailedFiles: 'Fichiers qui n’ont pas pu être joints :',
    appImportReasonTooLarge: 'au-delà de la taille maximale (50 Mo pour une vidéo, 5 Mo sinon)',
    appImportReasonUnreadable: 'un format illisible par ce navigateur',
    appImportReasonRejected: 'refusé par le serveur',
    appImportMoreFailed_one: '…et {count} autre',
    appImportMoreFailed_other: '…et {count} autres',
    appImportAnother: 'Importer un autre export',
    appImportKindLegend: 'Que voulez-vous importer ?',
    appImportKindApps: 'Day One ou Journey',
    appImportKindDailyNotes: 'Notes quotidiennes (Obsidian, Logseq)',
    appImportDailyNotesDescription:
      'Choisissez un .zip de vos notes quotidiennes : le dossier des notes quotidiennes d’un coffre Obsidian, ou le dossier journals d’un graphe Logseq (le coffre ou le graphe entier convient aussi). Chaque note nommée par son jour, comme 2024-03-14.md ou 2024_03_14.md, devient une entrée Markdown à ce jour, avec ses tags et les images qu’elle intègre. Il est lu dans votre navigateur ; seuls les entrées et leurs fichiers sont envoyés.',
    appImportNoDailyNotes: 'Aucune note quotidienne dans ce fichier. Choisissez un .zip de notes Markdown nommées par leur jour, comme 2024-03-14.md ou 2024_03_14.md.',
    appImportTooLarge: 'Cette archive est trop volumineuse pour être importée en une fois (plus de 50 000 fichiers, ou plus de 200 Mo de notes). Compressez le dossier des notes quotidiennes seul, ou répartissez-le en plusieurs archives.',
    appImportFoundDailyNotes: 'Dans vos notes quotidiennes',
    appImportStatSkippedNotes: 'Notes ignorées',
    appImportSkippedUndated: 'Pas nommées par un jour : {count}',
    appImportSkippedEmpty: 'Vides : {count}',
    appImportSkippedTooLarge: 'Plus de 5 Mo : {count}',
    appImportSkippedUnsafe: 'Liens, ou chemins et noms non fiables : {count}',
    appImportDailyNotesDiary: 'Les entrées vont dans {diaryName}, le journal choisi pour cette page.',
    appImportKindKeep: 'Google Keep',
    appImportKeepDescription:
      'Choisissez le .zip créé par Google Takeout pour vos notes Keep (takeout.google.com, avec Keep sélectionné). Chaque note devient une entrée Markdown au jour de sa création, avec son titre, ses libellés comme tags, ses listes de cases à cocher comme listes de tâches et ses images. Les notes archivées restent archivées, les notes épinglées sont épinglées tant que votre limite d’entrées épinglées le permet, et les notes de la corbeille sont ignorées. Il est lu dans votre navigateur ; seuls les entrées et leurs fichiers sont envoyés.',
    appImportNoKeepNotes: 'Aucune note Google Keep dans ce fichier. Choisissez le .zip créé par Google Takeout, avec son dossier Keep.',
    appImportKeepTooLarge: 'Cette archive est trop volumineuse pour être importée en une fois (plus de 50 000 fichiers, ou plus de 200 Mo de notes). Exportez Keep seul depuis Google Takeout, ou répartissez l’archive.',
    appImportSkippedTrashed: 'Dans la corbeille : {count}',
    appImportSkippedNoDate: 'Sans date : {count}',
    appImportSkippedUnreadable: 'Illisibles : {count}',
    formatMarkdownFolder: 'Dossier Markdown avec pièces jointes (.zip)',
  },
};

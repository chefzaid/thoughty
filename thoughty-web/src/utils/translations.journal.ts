import type { Language } from './translations';

/** Journal entries: the entry cards and their actions, attachments, bulk selection, history, cross-references, highlights and listening. */
export type JournalTranslationKey =
  | "deleteEntryTitle"
  | "deleteEntryMessage"
  | "noEntriesFound"
  | "entryWordCount_one"
  | "entryWordCount_other"
  | "entryReadingTimeMinutes"
  | "entryReadingTimeLessThanMinute"
  | "entryTemplate"
  | "noEntryTemplate"
  | "saveEntryTemplate"
  | "deleteEntryTemplate"
  | "backToSource"
  | "navigateToEntryOn"
  | "backlinks"
  | "backlinksCount_one"
  | "backlinksCount_other"
  | "entryNotFound"
  | "entryNotFoundMessage"
  | "entryReferenceHint"
  | "highlightsTitle"
  | "randomThought"
  | "onThisDay"
  | "yearsAgo"
  | "randomize"
  | "highlightsError"
  | "seeHighlights"
  | "highlights"
  | "noHighlights"
  | "listen"
  | "stopListening"
  | "listenThisEntry"
  | "listenFromHere"
  | "bulkModeEnter"
  | "bulkModeExit"
  | "bulkSelected_one"
  | "bulkSelected_other"
  | "bulkDelete"
  | "bulkMakePublic"
  | "bulkMakePrivate"
  | "bulkRephrase"
  | "bulkAddTags"
  | "bulkMove"
  | "bulkClearSelection"
  | "bulkDeleteTitle"
  | "bulkDeleteMessage_one"
  | "bulkDeleteMessage_other"
  | "selectTags"
  | "attachFiles"
  | "removeAttachment"
  | "attachmentTypeNotAllowed"
  | "attachmentTooLarge"
  | "attachmentRejected"
  | "previewAttachment"
  | "captionsUnavailable"
  | "downloadAttachment"
  | "transcribeAudio"
  | "transcribingAudio"
  | "audioTranscript"
  | "copyTranscript"
  | "transcriptCopied"
  | "audioTranscriptionFailed"
  | "favorite"
  | "unfavorite"
  | "pinEntry"
  | "unpinEntry"
  | "pinUpdateFailed"
  | "taskUpdateFailed"
  | "pinned"
  | "pinnedEntries"
  | "favorites"
  | "filterFavorites"
  | "archive"
  | "unarchive"
  | "archived"
  | "activeEntries"
  | "filterArchived"
  | "bulkArchive"
  | "bulkUnarchive"
  | "entryPermalink"
  | "shareEntry"
  | "entryLinkCopied"
  | "moreActions"
  | "dragToReorder"
  | "history"
  | "viewHistory"
  | "noRevisions"
  | "revision";

export const journalTranslations: Record<Language, Record<JournalTranslationKey, string>> = {
  en: {
    deleteEntryTitle: "Delete Entry",
    deleteEntryMessage:
      "Move this entry to the recycle bin? You can restore it from there for 30 days.",
    noEntriesFound: "No entries found",
    entryWordCount_one: "{count} word",
    entryWordCount_other: "{count} words",
    entryReadingTimeMinutes: "{minutes} min read",
    entryReadingTimeLessThanMinute: "<1 min read",
    entryTemplate: "Entry template",
    noEntryTemplate: "Choose a template",
    saveEntryTemplate: "Save template",
    deleteEntryTemplate: "Delete template",
    backToSource: "Back to source entry",
    navigateToEntryOn: "Navigate to entry on {date}{index}",
    backlinks: "Backlinks",
    backlinksCount_one: "{count} link",
    backlinksCount_other: "{count} links",
    entryNotFound: "Entry not found",
    entryNotFoundMessage:
      "This entry may have been deleted, or the link is no longer valid.",
    entryReferenceHint:
      'Tip: Reference other entries by writing "[[yyyy-mm-dd]]" or "[[yyyy-mm-dd#X]]" where X is the index of the entry for that day',
    highlightsTitle: "Highlights",
    randomThought: "Random Thought",
    onThisDay: "On This Day",
    yearsAgo: "{years} year(s) ago",
    randomize: "Randomize",
    highlightsError: "Failed to load highlights",
    seeHighlights: "See Highlights of the Day",
    highlights: "Highlights",
    noHighlights:
      "No highlights available yet. Start writing entries to see them here!",
    listen: "Listen",
    stopListening: "Stop listening",
    listenThisEntry: "Read this entry",
    listenFromHere: "Read from here onwards",
    bulkModeEnter: "Select",
    bulkModeExit: "Cancel selection",
    bulkSelected_one: "{count} selected",
    bulkSelected_other: "{count} selected",
    bulkDelete: "Delete",
    bulkMakePublic: "Make public",
    bulkMakePrivate: "Make private",
    bulkRephrase: "Rephrase",
    bulkAddTags: "Add tags",
    bulkMove: "Move to diary",
    bulkClearSelection: "Clear",
    bulkDeleteTitle: "Delete entries",
    bulkDeleteMessage_one: "Move {count} entry to the recycle bin? You can restore it from there for 30 days.",
    bulkDeleteMessage_other: "Move {count} entries to the recycle bin? You can restore them from there for 30 days.",
    selectTags: "Select tags...",
    attachFiles: "Attach files",
    removeAttachment: "Remove attachment",
    attachmentTypeNotAllowed:
      "This file type is not allowed. Allowed: images, audio, PDF, plain text.",
    attachmentTooLarge: "File is too large. Maximum size is 5 MB.",
    attachmentRejected: "{name}: {reason}",
    previewAttachment: "Preview",
    captionsUnavailable: "No captions available",
    downloadAttachment: "Download attachment",
    transcribeAudio: "Transcribe audio",
    transcribingAudio: "Transcribing...",
    audioTranscript: "Transcript",
    copyTranscript: "Copy transcript",
    transcriptCopied: "Transcript copied",
    audioTranscriptionFailed:
      "Could not transcribe this audio. Check your AI key and try again.",
    favorite: "Add to favorites",
    unfavorite: "Remove from favorites",
    pinEntry: "Pin entry",
    unpinEntry: "Unpin entry",
    pinUpdateFailed: "Failed to update pinned state",
    taskUpdateFailed: "Failed to update the task.",
    pinned: "Pinned",
    pinnedEntries: "Pinned entries",
    favorites: "Favorites",
    filterFavorites: "Show favorites only",
    archive: "Archive entry",
    unarchive: "Restore entry",
    archived: "Archived",
    activeEntries: "Active",
    filterArchived: "Filter archived entries",
    bulkArchive: "Archive",
    bulkUnarchive: "Unarchive",
    entryPermalink: "Open entry permalink",
    shareEntry: "Share entry",
    entryLinkCopied: "Entry link copied",
    moreActions: "More actions",
    dragToReorder: "Drag to reorder",
    history: "History",
    viewHistory: "View history",
    noRevisions: "No previous versions",
    revision: "Revision",
  },
  fr: {
    deleteEntryTitle: "Supprimer l'entrée",
    deleteEntryMessage:
      "Placer cette entrée dans la corbeille ? Vous pourrez l’y restaurer pendant 30 jours.",
    noEntriesFound: "Aucune entrée trouvée",
    entryWordCount_one: "{count} mot",
    entryWordCount_other: "{count} mots",
    entryReadingTimeMinutes: "{minutes} min de lecture",
    entryReadingTimeLessThanMinute: "<1 min de lecture",
    entryTemplate: "Modèle d'entrée",
    noEntryTemplate: "Choisir un modèle",
    saveEntryTemplate: "Enregistrer le modèle",
    deleteEntryTemplate: "Supprimer le modèle",
    backToSource: "Retour à l'entrée source",
    navigateToEntryOn: "Aller à l'entrée du {date}{index}",
    backlinks: "Rétroliens",
    backlinksCount_one: "{count} lien",
    backlinksCount_other: "{count} liens",
    entryNotFound: "Entrée non trouvée",
    entryNotFoundMessage:
      "Cette entrée a peut-être été supprimée, ou le lien n'est plus valide.",
    entryReferenceHint:
      'Astuce : Référencez d\'autres entrées en écrivant "[[yyyy-mm-dd]]" ou "[[yyyy-mm-dd#X]]" où X est l\'index de l\'entrée pour ce jour',
    highlightsTitle: "À la une",
    randomThought: "Pensée aléatoire",
    onThisDay: "Ce jour-là",
    yearsAgo: "Il y a {years} an(s)",
    randomize: "Aléatoire",
    highlightsError: "Échec du chargement des mises en avant",
    seeHighlights: "Voir les moments forts du jour",
    highlights: "Moments forts",
    noHighlights:
      "Pas encore de moments forts. Commencez à écrire des entrées pour les voir ici !",
    listen: "Écouter",
    stopListening: "Arrêter l'écoute",
    listenThisEntry: "Lire cette entrée",
    listenFromHere: "Lire à partir d'ici",
    bulkModeEnter: "Sélectionner",
    bulkModeExit: "Annuler la sélection",
    bulkSelected_one: "{count} sélectionnée",
    bulkSelected_other: "{count} sélectionnées",
    bulkDelete: "Supprimer",
    bulkMakePublic: "Rendre public",
    bulkMakePrivate: "Rendre privé",
    bulkRephrase: "Reformuler",
    bulkAddTags: "Ajouter des tags",
    bulkMove: "Déplacer vers le journal",
    bulkClearSelection: "Effacer",
    bulkDeleteTitle: "Supprimer les entrées",
    bulkDeleteMessage_one: "Placer {count} entrée dans la corbeille ? Vous pourrez l'y restaurer pendant 30 jours.",
    bulkDeleteMessage_other: "Placer {count} entrées dans la corbeille ? Vous pourrez les y restaurer pendant 30 jours.",
    selectTags: "Sélectionner des tags...",
    attachFiles: "Joindre des fichiers",
    removeAttachment: "Supprimer la pièce jointe",
    attachmentTypeNotAllowed:
      "Ce type de fichier n'est pas autorisé. Autorisés : images, audio, PDF, texte brut.",
    attachmentTooLarge:
      "Le fichier est trop volumineux. Taille maximale : 5 Mo.",
    attachmentRejected: "{name} : {reason}",
    previewAttachment: "Aperçu",
    captionsUnavailable: "Aucun sous-titre disponible",
    downloadAttachment: "Télécharger la pièce jointe",
    transcribeAudio: "Transcrire l'audio",
    transcribingAudio: "Transcription...",
    audioTranscript: "Transcription",
    copyTranscript: "Copier la transcription",
    transcriptCopied: "Transcription copiée",
    audioTranscriptionFailed:
      "Impossible de transcrire cet audio. Vérifiez votre clé IA et réessayez.",
    favorite: "Ajouter aux favoris",
    unfavorite: "Retirer des favoris",
    pinEntry: "Épingler l'entrée",
    unpinEntry: "Désépingler l'entrée",
    pinUpdateFailed: "Échec de la mise à jour de l'épinglage",
    taskUpdateFailed: "Échec de la mise à jour de la tâche.",
    pinned: "Épinglée",
    pinnedEntries: "Entrées épinglées",
    favorites: "Favoris",
    filterFavorites: "Afficher les favoris uniquement",
    archive: "Archiver l'entrée",
    unarchive: "Restaurer l'entrée",
    archived: "Archivée",
    activeEntries: "Actives",
    filterArchived: "Filtrer les entrées archivées",
    bulkArchive: "Archiver",
    bulkUnarchive: "Désarchiver",
    entryPermalink: "Ouvrir le permalien de l'entrée",
    shareEntry: "Partager l'entrée",
    entryLinkCopied: "Lien de l'entrée copié",
    moreActions: "Plus d'actions",
    dragToReorder: "Glisser pour réorganiser",
    history: "Historique",
    viewHistory: "Voir l'historique",
    noRevisions: "Aucune version précédente",
    revision: "Révision",
  },
};

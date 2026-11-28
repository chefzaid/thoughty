import type { Language } from './translations';

/** Reading notes: a PDF or EPUB read on the Import page, and the notes taken on it saved as entries. */
export type ReadingNotesTranslationKey =
  | 'readingNotesTitle'
  | 'readingNotesDescription'
  | 'readingNotesOpen'
  | 'readingNotesOpening'
  | 'readingNotesUnsupported'
  | 'readingNotesTooLarge'
  | 'readingNotesDamaged'
  | 'readingNotesProtected'
  | 'readingNotesEmptyBook'
  | 'readingNotesPending'
  | 'readingNotesCount_one'
  | 'readingNotesCount_other'
  | 'readingNotesSave'
  | 'readingNotesSaveShort'
  | 'readingNotesSaveHint'
  | 'readingNotesSaving'
  | 'readingNotesSaved_one'
  | 'readingNotesSaved_other'
  | 'readingNotesSaveFailed'
  | 'readingNotesDiscard'
  | 'readingNotesDiscardTitle'
  | 'readingNotesDiscardMessage'
  | 'readingNotesPage'
  | 'readingNotesChapter'
  | 'readingNotesSourcePage'
  | 'readingNotesSourceChapter'
  | 'readingNotesNavigation'
  | 'readingNotesGoTo'
  | 'readingNotesPreviousPage'
  | 'readingNotesNextPage'
  | 'readingNotesPreviousChapter'
  | 'readingNotesNextChapter'
  | 'readingNotesLoadingPage'
  | 'readingNotesPageError'
  | 'readingNotesNoText'
  | 'readingNotesAdd'
  | 'readingNotesAddOnPassage'
  | 'readingNotesSelectHint'
  | 'readingNotesNewTitle'
  | 'readingNotesEditTitle'
  | 'readingNotesPassage'
  | 'readingNotesYourNote'
  | 'readingNotesKeepNote'
  | 'readingNotesNone'
  | 'readingNotesEdit'
  | 'readingNotesEditOn'
  | 'readingNotesRemove'
  | 'readingNotesRemoveOn';

export const readingNotesTranslations: Record<Language, Record<ReadingNotesTranslationKey, string>> = {
  en: {
    readingNotesTitle: 'Reading notes',
    readingNotesDescription: 'Open a PDF or EPUB book, read it here and keep notes on the passages that speak to you. The book is read on this device and never sent; each note you save becomes a private entry in {diaryName}.',
    readingNotesOpen: 'Open a book (PDF or EPUB)',
    readingNotesOpening: 'Opening {name}…',
    readingNotesUnsupported: 'This file is not a PDF or EPUB book.',
    readingNotesTooLarge: 'This book is larger than 100 MB, too large to read here.',
    readingNotesDamaged: 'This book could not be read. It may be damaged or protected by a password.',
    readingNotesProtected: 'This book is protected against copying (DRM), so its text cannot be read here.',
    readingNotesEmptyBook: 'This book has no text to read (it may hold only scanned pictures).',
    readingNotesPending: 'Notes not saved to your journal yet',
    readingNotesCount_one: '{count} note',
    readingNotesCount_other: '{count} notes',
    readingNotesSave: 'Save the notes to {diaryName}',
    readingNotesSaveShort: 'Save to the journal',
    readingNotesSaveHint: 'Each note becomes a private entry on the day you took it. Notes not saved stay on this device until you save or discard them, or sign out.',
    readingNotesSaving: 'Saving…',
    readingNotesSaved_one: '{count} note saved to {diaryName}.',
    readingNotesSaved_other: '{count} notes saved to {diaryName}.',
    readingNotesSaveFailed: 'The notes could not be saved: {error}',
    readingNotesDiscard: 'Discard',
    readingNotesDiscardTitle: 'Discard these notes?',
    readingNotesDiscardMessage: 'The notes on “{title}” that are not saved to your journal will be removed from this device.',
    readingNotesPage: 'Page {page}',
    readingNotesChapter: 'Chapter {chapter}',
    readingNotesSourcePage: 'page {page}',
    readingNotesSourceChapter: 'chapter {chapter}',
    readingNotesNavigation: 'Pages of the book',
    readingNotesGoTo: 'Go to',
    readingNotesPreviousPage: 'Previous page',
    readingNotesNextPage: 'Next page',
    readingNotesPreviousChapter: 'Previous chapter',
    readingNotesNextChapter: 'Next chapter',
    readingNotesLoadingPage: 'Loading the text…',
    readingNotesPageError: 'This part of the book could not be read.',
    readingNotesNoText: 'No text here.',
    readingNotesAdd: 'Add a note',
    readingNotesAddOnPassage: 'Add a note on the selected passage',
    readingNotesSelectHint: 'Select a passage first to quote it in your note.',
    readingNotesNewTitle: 'New note',
    readingNotesEditTitle: 'Change the note',
    readingNotesPassage: 'Passage (optional)',
    readingNotesYourNote: 'Your note',
    readingNotesKeepNote: 'Keep the note',
    readingNotesNone: 'No notes on this book yet.',
    readingNotesEdit: 'Edit',
    readingNotesEditOn: 'Edit the note ({location})',
    readingNotesRemove: 'Remove',
    readingNotesRemoveOn: 'Remove the note ({location})',
  },
  fr: {
    readingNotesTitle: 'Notes de lecture',
    readingNotesDescription: 'Ouvrez un livre PDF ou EPUB, lisez-le ici et prenez des notes sur les passages qui vous parlent. Le livre est lu sur cet appareil et n’est jamais envoyé ; chaque note enregistrée devient une entrée privée dans {diaryName}.',
    readingNotesOpen: 'Ouvrir un livre (PDF ou EPUB)',
    readingNotesOpening: 'Ouverture de {name}…',
    readingNotesUnsupported: 'Ce fichier n’est pas un livre PDF ou EPUB.',
    readingNotesTooLarge: 'Ce livre dépasse 100 Mo, trop pour être lu ici.',
    readingNotesDamaged: 'Ce livre n’a pas pu être lu. Il est peut-être endommagé ou protégé par un mot de passe.',
    readingNotesProtected: 'Ce livre est protégé contre la copie (DRM) : son texte ne peut pas être lu ici.',
    readingNotesEmptyBook: 'Ce livre n’a pas de texte à lire (il ne contient peut-être que des images numérisées).',
    readingNotesPending: 'Notes pas encore enregistrées dans votre journal',
    readingNotesCount_one: '{count} note',
    readingNotesCount_other: '{count} notes',
    readingNotesSave: 'Enregistrer les notes dans {diaryName}',
    readingNotesSaveShort: 'Enregistrer dans le journal',
    readingNotesSaveHint: 'Chaque note devient une entrée privée au jour où vous l’avez prise. Les notes non enregistrées restent sur cet appareil jusqu’à ce que vous les enregistriez ou les abandonniez, ou que vous vous déconnectiez.',
    readingNotesSaving: 'Enregistrement…',
    readingNotesSaved_one: '{count} note enregistrée dans {diaryName}.',
    readingNotesSaved_other: '{count} notes enregistrées dans {diaryName}.',
    readingNotesSaveFailed: 'Les notes n’ont pas pu être enregistrées : {error}',
    readingNotesDiscard: 'Abandonner',
    readingNotesDiscardTitle: 'Abandonner ces notes ?',
    readingNotesDiscardMessage: 'Les notes sur « {title} » qui ne sont pas enregistrées dans votre journal seront supprimées de cet appareil.',
    readingNotesPage: 'Page {page}',
    readingNotesChapter: 'Chapitre {chapter}',
    readingNotesSourcePage: 'page {page}',
    readingNotesSourceChapter: 'chapitre {chapter}',
    readingNotesNavigation: 'Pages du livre',
    readingNotesGoTo: 'Aller à',
    readingNotesPreviousPage: 'Page précédente',
    readingNotesNextPage: 'Page suivante',
    readingNotesPreviousChapter: 'Chapitre précédent',
    readingNotesNextChapter: 'Chapitre suivant',
    readingNotesLoadingPage: 'Chargement du texte…',
    readingNotesPageError: 'Cette partie du livre n’a pas pu être lue.',
    readingNotesNoText: 'Pas de texte ici.',
    readingNotesAdd: 'Ajouter une note',
    readingNotesAddOnPassage: 'Ajouter une note sur le passage choisi',
    readingNotesSelectHint: 'Sélectionnez d’abord un passage pour le citer dans votre note.',
    readingNotesNewTitle: 'Nouvelle note',
    readingNotesEditTitle: 'Modifier la note',
    readingNotesPassage: 'Passage (facultatif)',
    readingNotesYourNote: 'Votre note',
    readingNotesKeepNote: 'Garder la note',
    readingNotesNone: 'Aucune note sur ce livre pour l’instant.',
    readingNotesEdit: 'Modifier',
    readingNotesEditOn: 'Modifier la note ({location})',
    readingNotesRemove: 'Retirer',
    readingNotesRemoveOn: 'Retirer la note ({location})',
  },
};

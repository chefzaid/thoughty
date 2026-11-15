import type { Language } from './translations';

/** Moving one entry to another diary: the entry menu action, its dialog, the editor's diary field and the notices. */
export type MoveToDiaryTranslationKey =
  | 'moveToDiaryAction'
  | 'moveToDiaryTitle'
  | 'moveToDiaryCurrent'
  | 'moveToDiaryChoices'
  | 'moveToDiaryConfirm'
  | 'moveToDiaryChooseFirst'
  | 'entryMovedToDiary'
  | 'entryMovedOutOfDiary'
  | 'moveToDiaryShow'
  | 'entryMoveFailed'
  | 'entrySavedNotMoved'
  | 'entryDiaryLabel';

export const moveToDiaryTranslations: Record<Language, Record<MoveToDiaryTranslationKey, string>> = {
  en: {
    moveToDiaryAction: 'Move to diary…',
    moveToDiaryTitle: 'Move to diary',
    moveToDiaryCurrent: 'Now in {diary}',
    moveToDiaryChoices: 'Diaries',
    moveToDiaryConfirm: 'Move',
    moveToDiaryChooseFirst: 'Choose the diary to move the entry to.',
    entryMovedToDiary: 'Entry moved to {diary}.',
    entryMovedOutOfDiary: 'Entry moved to {diary}. It no longer shows in this diary.',
    moveToDiaryShow: 'Open {diary}',
    entryMoveFailed: 'The entry could not be moved.',
    entrySavedNotMoved: 'Your changes are saved, but the entry could not be moved.',
    entryDiaryLabel: 'Diary',
  },
  fr: {
    moveToDiaryAction: 'Déplacer vers un journal…',
    moveToDiaryTitle: 'Déplacer vers un journal',
    moveToDiaryCurrent: 'Actuellement dans {diary}',
    moveToDiaryChoices: 'Journaux',
    moveToDiaryConfirm: 'Déplacer',
    moveToDiaryChooseFirst: 'Choisissez le journal vers lequel déplacer l’entrée.',
    entryMovedToDiary: 'Entrée déplacée vers {diary}.',
    entryMovedOutOfDiary: 'Entrée déplacée vers {diary}. Elle n’apparaît plus dans ce journal.',
    moveToDiaryShow: 'Ouvrir {diary}',
    entryMoveFailed: 'Impossible de déplacer l’entrée.',
    entrySavedNotMoved: 'Vos modifications sont enregistrées, mais l’entrée n’a pas pu être déplacée.',
    entryDiaryLabel: 'Journal',
  },
};

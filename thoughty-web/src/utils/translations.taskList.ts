import type { Language } from './translations';

export type TaskListTranslationKey =
  | 'markdownTaskListButton'
  | 'markdownHelpButton'
  | 'markdownHelpSummary'
  | 'markdownHelpBold'
  | 'markdownHelpItalic'
  | 'markdownHelpHeading'
  | 'markdownHelpList'
  | 'markdownHelpTask'
  | 'markdownHelpTaskDone'
  | 'markdownHelpReference';

export const taskListTranslations: Record<Language, Record<TaskListTranslationKey, string>> = {
  en: {
    markdownTaskListButton: 'Add a task list (ctrl + shift + c)',
    markdownHelpButton: 'Open the Markdown guide',
    markdownHelpSummary: 'Markdown help',
    markdownHelpBold: 'bold text',
    markdownHelpItalic: 'italic text',
    markdownHelpHeading: 'a heading (## for a smaller one)',
    markdownHelpList: 'a bulleted list',
    markdownHelpTask: 'a task, ticked off later right from the journal',
    markdownHelpTaskDone: 'a task already done',
    markdownHelpReference: 'a link to that day’s entry (#2 for its second entry)',
  },
  fr: {
    markdownTaskListButton: 'Ajouter une liste de tâches (ctrl + maj + c)',
    markdownHelpButton: 'Ouvrir le guide Markdown',
    markdownHelpSummary: 'Aide Markdown',
    markdownHelpBold: 'texte en gras',
    markdownHelpItalic: 'texte en italique',
    markdownHelpHeading: 'un titre (## pour un titre plus petit)',
    markdownHelpList: 'une liste à puces',
    markdownHelpTask: 'une tâche, à cocher ensuite directement dans le journal',
    markdownHelpTaskDone: 'une tâche déjà faite',
    markdownHelpReference: 'un lien vers l’entrée de ce jour (#2 pour sa deuxième entrée)',
  },
};

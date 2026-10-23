import type { Language } from './translations';

/** Names of the Markdown editor's toolbar buttons; the task list and guide buttons are in translations.taskList. */
export type MarkdownToolbarTranslationKey =
  | 'markdownToolbarBold'
  | 'markdownToolbarItalic'
  | 'markdownToolbarStrikethrough'
  | 'markdownToolbarRule'
  | 'markdownToolbarHeadings'
  | 'markdownToolbarHeading'
  | 'markdownToolbarHeadingLevel'
  | 'markdownToolbarLink'
  | 'markdownToolbarQuote'
  | 'markdownToolbarCode'
  | 'markdownToolbarCodeBlock'
  | 'markdownToolbarComment'
  | 'markdownToolbarImage'
  | 'markdownToolbarTable'
  | 'markdownToolbarBulletList'
  | 'markdownToolbarNumberedList'
  | 'markdownToolbarEditOnly'
  | 'markdownToolbarEditAndPreview'
  | 'markdownToolbarPreviewOnly'
  | 'markdownToolbarFullscreen';

export const markdownToolbarTranslations: Record<Language, Record<MarkdownToolbarTranslationKey, string>> = {
  en: {
    markdownToolbarBold: 'Add bold text (ctrl + b)',
    markdownToolbarItalic: 'Add italic text (ctrl + i)',
    markdownToolbarStrikethrough: 'Add strikethrough text (ctrl + shift + x)',
    markdownToolbarRule: 'Insert a horizontal rule (ctrl + h)',
    markdownToolbarHeadings: 'Insert a heading',
    markdownToolbarHeading: 'Insert a level {level} heading (ctrl + {shortcut})',
    markdownToolbarHeadingLevel: 'Heading {level}',
    markdownToolbarLink: 'Add a link (ctrl + l)',
    markdownToolbarQuote: 'Insert a quote (ctrl + q)',
    markdownToolbarCode: 'Insert code (ctrl + j)',
    markdownToolbarCodeBlock: 'Insert a code block (ctrl + shift + j)',
    markdownToolbarComment: 'Insert a comment (ctrl + /)',
    markdownToolbarImage: 'Add an image (ctrl + k)',
    markdownToolbarTable: 'Add a table',
    markdownToolbarBulletList: 'Add a bulleted list (ctrl + shift + u)',
    markdownToolbarNumberedList: 'Add a numbered list (ctrl + shift + o)',
    markdownToolbarEditOnly: 'Write without the preview (ctrl + 7)',
    markdownToolbarEditAndPreview: 'Write beside the preview (ctrl + 8)',
    markdownToolbarPreviewOnly: 'Show only the preview (ctrl + 9)',
    markdownToolbarFullscreen: 'Toggle full screen (ctrl + 0)',
  },
  fr: {
    markdownToolbarBold: 'Mettre en gras (ctrl + b)',
    markdownToolbarItalic: 'Mettre en italique (ctrl + i)',
    markdownToolbarStrikethrough: 'Barrer le texte (ctrl + maj + x)',
    markdownToolbarRule: 'Insérer un trait horizontal (ctrl + h)',
    markdownToolbarHeadings: 'Insérer un titre',
    markdownToolbarHeading: 'Insérer un titre de niveau {level} (ctrl + {shortcut})',
    markdownToolbarHeadingLevel: 'Titre {level}',
    markdownToolbarLink: 'Ajouter un lien (ctrl + l)',
    markdownToolbarQuote: 'Insérer une citation (ctrl + q)',
    markdownToolbarCode: 'Insérer du code (ctrl + j)',
    markdownToolbarCodeBlock: 'Insérer un bloc de code (ctrl + maj + j)',
    markdownToolbarComment: 'Insérer un commentaire (ctrl + /)',
    markdownToolbarImage: 'Ajouter une image (ctrl + k)',
    markdownToolbarTable: 'Ajouter un tableau',
    markdownToolbarBulletList: 'Ajouter une liste à puces (ctrl + maj + u)',
    markdownToolbarNumberedList: 'Ajouter une liste numérotée (ctrl + maj + o)',
    markdownToolbarEditOnly: 'Écrire sans l’aperçu (ctrl + 7)',
    markdownToolbarEditAndPreview: 'Écrire à côté de l’aperçu (ctrl + 8)',
    markdownToolbarPreviewOnly: 'Afficher seulement l’aperçu (ctrl + 9)',
    markdownToolbarFullscreen: 'Basculer en plein écran (ctrl + 0)',
  },
};

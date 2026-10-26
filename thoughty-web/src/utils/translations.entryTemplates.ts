import type { Language } from './translations';

export type EntryTemplatesTranslationKey =
  | 'templateNameDialogTitle'
  | 'templateNameDialogDescription'
  | 'templateNameLabel'
  | 'templateNameRequired'
  | 'templateSaving';

export const entryTemplatesTranslations: Record<Language, Record<EntryTemplatesTranslationKey, string>> = {
  en: {
    templateNameDialogTitle: 'Save as a template',
    templateNameDialogDescription: 'The template keeps the text, tags, visibility and format of your draft.',
    templateNameLabel: 'Template name',
    templateNameRequired: 'Enter a name for the template.',
    templateSaving: 'Saving...',
  },
  fr: {
    templateNameDialogTitle: 'Enregistrer comme modèle',
    templateNameDialogDescription: 'Le modèle reprend le texte, les tags, la visibilité et le format de votre brouillon.',
    templateNameLabel: 'Nom du modèle',
    templateNameRequired: 'Saisissez un nom pour le modèle.',
    templateSaving: 'Enregistrement...',
  },
};

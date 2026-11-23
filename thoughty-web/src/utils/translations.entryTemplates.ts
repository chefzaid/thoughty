import type { Language } from './translations';

export type EntryTemplatesTranslationKey =
  | 'templateNameDialogTitle'
  | 'templateNameDialogDescription'
  | 'templateNameLabel'
  | 'templateNameRequired'
  | 'templateNameAtLimit'
  | 'templateSaveFailed'
  | 'templateSaving'
  | 'diaryDefaultTemplate'
  | 'diaryDefaultTemplateNone'
  | 'diaryDefaultTemplateMissing'
  | 'diaryDefaultTemplateHint'
  | 'diaryDefaultTemplateSummary'
  | 'diaryTemplateStarted';

export const entryTemplatesTranslations: Record<Language, Record<EntryTemplatesTranslationKey, string>> = {
  en: {
    templateNameDialogTitle: 'Save as a template',
    templateNameDialogDescription: 'The template keeps the text, tags, visibility and format of your draft.',
    templateNameLabel: 'Template name',
    templateNameRequired: 'Enter a name for the template.',
    templateNameAtLimit: 'A template name can be up to {max} characters.',
    templateSaveFailed: 'The template could not be saved. Try again.',
    templateSaving: 'Saving...',
    diaryDefaultTemplate: 'Default template',
    diaryDefaultTemplateNone: 'No template',
    diaryDefaultTemplateMissing: 'Deleted template',
    diaryDefaultTemplateHint: 'A new entry in this diary starts from this template when the composer is empty.',
    diaryDefaultTemplateSummary: 'Template: {name}',
    diaryTemplateStarted: "Started from this diary's template, {name}.",
  },
  fr: {
    templateNameDialogTitle: 'Enregistrer comme modèle',
    templateNameDialogDescription: 'Le modèle reprend le texte, les tags, la visibilité et le format de votre brouillon.',
    templateNameLabel: 'Nom du modèle',
    templateNameRequired: 'Saisissez un nom pour le modèle.',
    templateNameAtLimit: "Le nom d'un modèle peut compter jusqu'à {max} caractères.",
    templateSaveFailed: "Le modèle n'a pas pu être enregistré. Réessayez.",
    templateSaving: 'Enregistrement...',
    diaryDefaultTemplate: 'Modèle par défaut',
    diaryDefaultTemplateNone: 'Aucun modèle',
    diaryDefaultTemplateMissing: 'Modèle supprimé',
    diaryDefaultTemplateHint: "Une nouvelle entrée de ce journal part de ce modèle quand l'éditeur est vide.",
    diaryDefaultTemplateSummary: 'Modèle : {name}',
    diaryTemplateStarted: 'Commencé à partir du modèle de ce journal, {name}.',
  },
};

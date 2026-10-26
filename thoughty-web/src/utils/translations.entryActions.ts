import type { Language } from './translations';

/** Messages of the entry hooks: writing form errors, AI writing helpers and the notices of edits and bulk actions. */
export type EntryActionsTranslationKey =
  | 'entryTextRequired'
  | 'entryTagRequired'
  | 'entrySaveFailed'
  | 'fixWritingNeedsText'
  | 'fixWritingFailed'
  | 'fixWritingNoChanges'
  | 'suggestTagsNeedsText'
  | 'suggestTagsFailed'
  | 'suggestTagsEmpty'
  | 'entryEditRequired'
  | 'entryUpdateFailed'
  | 'entryDeleteFailed'
  | 'rephraseEntryFailed'
  | 'bulkOperationFailed'
  | 'bulkRephraseNoEntries'
  | 'bulkRephraseNothingToChange'
  | 'bulkRephraseError'
  | 'bulkRephraseSummary'
  | 'bulkRephraseUpdated_one'
  | 'bulkRephraseUpdated_other'
  | 'bulkRephraseUnchanged_one'
  | 'bulkRephraseUnchanged_other'
  | 'bulkRephraseFailedCount_one'
  | 'bulkRephraseFailedCount_other';

export const entryActionsTranslations: Record<Language, Record<EntryActionsTranslationKey, string>> = {
  en: {
    entryTextRequired: 'Please enter some text',
    entryTagRequired: 'Please add at least one tag',
    entrySaveFailed: 'Failed to save entry. Please try again.',
    fixWritingNeedsText: 'Write a thought before asking for writing fixes',
    fixWritingFailed: 'Unable to fix writing. Check your OpenRouter API key and try again.',
    fixWritingNoChanges: 'No corrections were needed.',
    suggestTagsNeedsText: 'Write a thought before asking for tag suggestions',
    suggestTagsFailed: 'Unable to suggest tags. Check your OpenRouter API key and try again.',
    suggestTagsEmpty: 'No tag suggestions were returned. Try adding more detail.',
    entryEditRequired: 'Text and at least one tag are required',
    entryUpdateFailed: 'Failed to update entry.',
    entryDeleteFailed: 'Failed to delete entry.',
    rephraseEntryFailed: 'Unable to rephrase entry. Check your OpenRouter API key and try again.',
    bulkOperationFailed: 'Bulk operation failed.',
    bulkRephraseNoEntries: 'No selected entries are available to rephrase.',
    bulkRephraseNothingToChange: 'No selected entries needed rephrasing.',
    bulkRephraseError: 'Bulk rephrase failed.',
    bulkRephraseSummary: 'Bulk rephrase completed: {updated}, {unchanged}, {failed}.',
    bulkRephraseUpdated_one: '{count} updated',
    bulkRephraseUpdated_other: '{count} updated',
    bulkRephraseUnchanged_one: '{count} unchanged',
    bulkRephraseUnchanged_other: '{count} unchanged',
    bulkRephraseFailedCount_one: '{count} failed',
    bulkRephraseFailedCount_other: '{count} failed',
  },
  fr: {
    entryTextRequired: 'Veuillez saisir du texte',
    entryTagRequired: 'Veuillez ajouter au moins un tag',
    entrySaveFailed: 'Impossible d’enregistrer l’entrée. Veuillez réessayer.',
    fixWritingNeedsText: 'Écrivez une pensée avant de demander des corrections',
    fixWritingFailed: 'Impossible de corriger le texte. Vérifiez votre clé API OpenRouter et réessayez.',
    fixWritingNoChanges: 'Aucune correction n’était nécessaire.',
    suggestTagsNeedsText: 'Écrivez une pensée avant de demander des suggestions de tags',
    suggestTagsFailed: 'Impossible de suggérer des tags. Vérifiez votre clé API OpenRouter et réessayez.',
    suggestTagsEmpty: 'Aucune suggestion de tag n’a été renvoyée. Essayez d’ajouter plus de détails.',
    entryEditRequired: 'Le texte et au moins un tag sont requis',
    entryUpdateFailed: 'Impossible de mettre à jour l’entrée.',
    entryDeleteFailed: 'Impossible de supprimer l’entrée.',
    rephraseEntryFailed: 'Impossible de reformuler l’entrée. Vérifiez votre clé API OpenRouter et réessayez.',
    bulkOperationFailed: 'L’opération groupée a échoué.',
    bulkRephraseNoEntries: 'Aucune des entrées sélectionnées ne peut être reformulée.',
    bulkRephraseNothingToChange: 'Aucune des entrées sélectionnées n’avait besoin d’être reformulée.',
    bulkRephraseError: 'La reformulation groupée a échoué.',
    bulkRephraseSummary: 'Reformulation groupée terminée : {updated}, {unchanged}, {failed}.',
    bulkRephraseUpdated_one: '{count} mise à jour',
    bulkRephraseUpdated_other: '{count} mises à jour',
    bulkRephraseUnchanged_one: '{count} inchangée',
    bulkRephraseUnchanged_other: '{count} inchangées',
    bulkRephraseFailedCount_one: '{count} en échec',
    bulkRephraseFailedCount_other: '{count} en échec',
  },
};

import type { Language } from './translations';

/** The tag manager, the tag picker and the journal retag review. */
export type TagsTranslationKey =
  | "tagOrganization"
  | "tagOrganizationDescription"
  | "organizeJournalTags"
  | "journalRetagTitle"
  | "journalRetagDescription"
  | "scanningJournalTags"
  | "journalRetagError"
  | "journalRetagApplyError"
  | "journalRetagApplied_one"
  | "journalRetagApplied_other"
  | "journalRetagScanCount_one"
  | "journalRetagScanCount_other"
  | "journalRetagLimited"
  | "journalTagsFound"
  | "journalRetagEmpty"
  | "journalRetagMode"
  | "journalRetagReplace"
  | "journalRetagAdd"
  | "clearSelection"
  | "currentTags"
  | "suggestedTags"
  | "noTags"
  | "noMatchingTag"
  | "tagPickerCreate"
  | "tagPickerNoTags"
  | "journalRetagSelected_one"
  | "journalRetagSelected_other"
  | "applyingJournalRetag"
  | "applyJournalRetag"
  | "tagCategory"
  | "tagCategoryPlaceholder"
  | "tagColor"
  | "renameTagPlaceholder"
  | "noTagsToOrganize"
  | "resetTagAppearance"
  | "tagNameLabel"
  | "newTag"
  | "newTagPlaceholder"
  | "addTag"
  | "tagAlreadyExists"
  | "deleteTag"
  | "removeTagNamed"
  | "deleteTagConfirm_one"
  | "deleteTagConfirm_other"
  | "deleteTagFailed"
  | "tagUsageCount_one"
  | "tagUsageCount_other"
  | "tagUnused";

export const tagsTranslations: Record<Language, Record<TagsTranslationKey, string>> = {
  en: {
    tagOrganization: "Tag Organization",
    tagOrganizationDescription:
      "Create, rename, color, and delete tags. Changes apply across all your entries.",
    organizeJournalTags: "Organize journal tags",
    journalRetagTitle: "Review suggested tags",
    journalRetagDescription: "AI proposes a compact set of tags for your journal. Review every change before applying it.",
    scanningJournalTags: "Analyzing your journal...",
    journalRetagError: "Could not analyze the journal.",
    journalRetagApplyError: "Could not apply the selected tag changes.",
    journalRetagApplied_one: "Updated {count} entry.",
    journalRetagApplied_other: "Updated {count} entries.",
    journalRetagScanCount_one: "Analyzed {analyzed} of {count} entry.",
    journalRetagScanCount_other: "Analyzed {analyzed} of {count} entries.",
    journalRetagLimited: "Only the 300 most recent entries were analyzed.",
    journalTagsFound: "Tags proposed",
    journalRetagEmpty: "Write an entry before organizing journal tags.",
    journalRetagMode: "Tag update mode",
    journalRetagReplace: "Replace tags",
    journalRetagAdd: "Add tags",
    clearSelection: "Clear selection",
    currentTags: "Current tags",
    suggestedTags: "Suggested tags",
    noTags: "No tags",
    noMatchingTag: "No matching tag",
    tagPickerCreate: "Create \"{tag}\"",
    tagPickerNoTags: "No tags found",
    journalRetagSelected_one: "{count} entry selected",
    journalRetagSelected_other: "{count} entries selected",
    applyingJournalRetag: "Applying changes...",
    applyJournalRetag: "Apply selected changes",
    tagCategory: "Category",
    tagCategoryPlaceholder: "Examples: Work, Health, Ideas",
    tagColor: "Color",
    renameTagPlaceholder: "Rename tag",
    noTagsToOrganize:
      "Create or save a few tags first, then organize them here.",
    resetTagAppearance: "Reset",
    tagNameLabel: "Name",
    newTag: "New tag",
    newTagPlaceholder: "Tag name",
    addTag: "Add tag",
    tagAlreadyExists: "That tag already exists.",
    deleteTag: "Delete tag",
    removeTagNamed: "Remove {tag} tag",
    deleteTagConfirm_one: "Delete #{tag}? It will be removed from {count} entry. The entry itself is kept.",
    deleteTagConfirm_other: "Delete #{tag}? It will be removed from {count} entries. The entries themselves are kept.",
    deleteTagFailed: "Unable to delete the tag. Please try again.",
    tagUsageCount_one: "{count} entry",
    tagUsageCount_other: "{count} entries",
    tagUnused: "Unused",
  },
  fr: {
    tagOrganization: "Organisation des tags",
    tagOrganizationDescription:
      "Créez, renommez, colorez et supprimez vos tags. Les changements s'appliquent à toutes vos entrées.",
    organizeJournalTags: "Organiser les tags du journal",
    journalRetagTitle: "Vérifier les tags suggérés",
    journalRetagDescription: "L'IA propose un ensemble compact de tags pour votre journal. Vérifiez chaque changement avant de l'appliquer.",
    scanningJournalTags: "Analyse de votre journal...",
    journalRetagError: "Impossible d'analyser le journal.",
    journalRetagApplyError: "Impossible d'appliquer les changements de tags sélectionnés.",
    journalRetagApplied_one: "{count} entrée mise à jour.",
    journalRetagApplied_other: "{count} entrées mises à jour.",
    journalRetagScanCount_one: "{analyzed} sur {count} entrée analysée.",
    journalRetagScanCount_other: "{analyzed} sur {count} entrées analysées.",
    journalRetagLimited:
      "Seules les 300 entrées les plus récentes ont été analysées.",
    journalTagsFound: "Tags proposés",
    journalRetagEmpty: "Écrivez une entrée avant d'organiser les tags du journal.",
    journalRetagMode: "Mode de mise à jour des tags",
    journalRetagReplace: "Remplacer les tags",
    journalRetagAdd: "Ajouter les tags",
    clearSelection: "Effacer la sélection",
    currentTags: "Tags actuels",
    suggestedTags: "Tags suggérés",
    noTags: "Aucun tag",
    noMatchingTag: "Aucun tag correspondant",
    tagPickerCreate: "Créer « {tag} »",
    tagPickerNoTags: "Aucun tag trouvé",
    journalRetagSelected_one: "{count} entrée sélectionnée",
    journalRetagSelected_other: "{count} entrées sélectionnées",
    applyingJournalRetag: "Application des changements...",
    applyJournalRetag: "Appliquer les changements sélectionnés",
    tagCategory: "Catégorie",
    tagCategoryPlaceholder: "Exemples : Travail, Santé, Idées",
    tagColor: "Couleur",
    renameTagPlaceholder: "Renommer le tag",
    noTagsToOrganize:
      "Créez ou enregistrez quelques tags puis organisez-les ici.",
    resetTagAppearance: "Réinitialiser",
    tagNameLabel: "Nom",
    newTag: "Nouveau tag",
    newTagPlaceholder: "Nom du tag",
    addTag: "Ajouter le tag",
    tagAlreadyExists: "Ce tag existe déjà.",
    deleteTag: "Supprimer le tag",
    removeTagNamed: "Retirer le tag {tag}",
    deleteTagConfirm_one: "Supprimer #{tag} ? Il sera retiré de {count} entrée. L'entrée elle-même est conservée.",
    deleteTagConfirm_other: "Supprimer #{tag} ? Il sera retiré de {count} entrées. Les entrées elles-mêmes sont conservées.",
    deleteTagFailed: "Impossible de supprimer le tag. Veuillez réessayer.",
    tagUsageCount_one: "{count} entrée",
    tagUsageCount_other: "{count} entrées",
    tagUnused: "Inutilisé",
  },
};

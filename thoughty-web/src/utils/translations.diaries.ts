import type { Language } from './translations';

/** The diary manager and diary picker. */
export type DiariesTranslationKey =
  | "diaries"
  | "manageDiaries"
  | "newDiary"
  | "diaryName"
  | "diaryColor"
  | "diaryVisibilityToggle"
  | "setAsDefault"
  | "defaultDiary"
  | "deleteDiary"
  | "deleteDiaryMessage"
  | "diaryNameRequired"
  | "diaryDefaultDeleteBlocked"
  | "diaryCreateFailed"
  | "diaryUpdateFailed"
  | "diaryDeleteFailed"
  | "diarySetDefaultFailed"
  | "diaryReorderFailed"
  | "createDiary"
  | "allDiaries"
  | "noDiaries"
  | "visibilityOverrideHint";

export const diariesTranslations: Record<Language, Record<DiariesTranslationKey, string>> = {
  en: {
    diaries: "Diaries",
    manageDiaries: "Manage Diaries",
    newDiary: "New Diary",
    diaryName: "Diary Name",
    diaryColor: "Color",
    diaryVisibilityToggle: "Toggle visibility",
    setAsDefault: "Set as Default",
    defaultDiary: "Default Diary",
    deleteDiary: "Delete Diary",
    deleteDiaryMessage: "“{name}” will be deleted. Its entries will be moved to your default diary.",
    diaryNameRequired: "Diary name is required",
    diaryDefaultDeleteBlocked: "Cannot delete the default diary",
    diaryCreateFailed: "Failed to create diary",
    diaryUpdateFailed: "Failed to update diary",
    diaryDeleteFailed: "Failed to delete diary",
    diarySetDefaultFailed: "Failed to set default diary",
    diaryReorderFailed: "Failed to reorder diaries",
    createDiary: "Create Diary",
    allDiaries: "All Diaries",
    noDiaries: "No diaries found. Create one to get started!",
    visibilityOverrideHint: "Can be overridden per entry",
  },
  fr: {
    diaries: "Journaux",
    manageDiaries: "Gérer les journaux",
    newDiary: "Nouveau journal",
    diaryName: "Nom du journal",
    diaryColor: "Couleur",
    diaryVisibilityToggle: "Changer la visibilité",
    setAsDefault: "Définir par défaut",
    defaultDiary: "Journal par défaut",
    deleteDiary: "Supprimer le journal",
    deleteDiaryMessage:
      "« {name} » sera supprimé. Ses entrées seront déplacées vers votre journal par défaut.",
    diaryNameRequired: "Le nom du journal est obligatoire",
    diaryDefaultDeleteBlocked: "Impossible de supprimer le journal par défaut",
    diaryCreateFailed: "Échec de la création du journal",
    diaryUpdateFailed: "Échec de la mise à jour du journal",
    diaryDeleteFailed: "Échec de la suppression du journal",
    diarySetDefaultFailed: "Échec du choix du journal par défaut",
    diaryReorderFailed: "Échec de la réorganisation des journaux",
    createDiary: "Créer un journal",
    allDiaries: "Tous les journaux",
    noDiaries: "Aucun journal trouvé. Créez-en un pour commencer !",
    visibilityOverrideHint: "Peut être modifié par entrée",
  },
};

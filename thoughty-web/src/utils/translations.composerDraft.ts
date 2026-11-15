import type { Language } from './translations';

export type ComposerDraftTranslationKey =
  | 'composerDraftSaving'
  | 'composerDraftSaved'
  | 'composerDraftOffline'
  | 'composerDraftLocal'
  | 'composerDraftRestore'
  | 'composerDraftContinue'
  | 'composerDraftDiscard'
  | 'composerDraftConflict'
  | 'composerDraftUseSaved'
  | 'composerDraftKeepThis'
  | 'composerDraftGone'
  | 'composerDraftKeepWriting'
  | 'composerDraftClear';

export const composerDraftTranslations: Record<Language, Record<ComposerDraftTranslationKey, string>> = {
  en: {
    composerDraftSaving: 'Saving…',
    composerDraftSaved: 'Draft saved',
    composerDraftOffline: 'Offline — saved on this device',
    composerDraftLocal: 'Saved on this device; it syncs when it can',
    composerDraftRestore: 'Continue your draft from {time}?',
    composerDraftContinue: 'Continue',
    composerDraftDiscard: 'Discard',
    composerDraftConflict: 'This draft was changed on another device at {time}.',
    composerDraftUseSaved: 'Use that version',
    composerDraftKeepThis: 'Keep this version',
    composerDraftGone: 'This draft was published or discarded on another device.',
    composerDraftKeepWriting: 'Keep writing it',
    composerDraftClear: 'Clear it',
  },
  fr: {
    composerDraftSaving: 'Enregistrement…',
    composerDraftSaved: 'Brouillon enregistré',
    composerDraftOffline: 'Hors ligne — enregistré sur cet appareil',
    composerDraftLocal: 'Enregistré sur cet appareil ; il se synchronisera dès que possible',
    composerDraftRestore: 'Reprendre votre brouillon ({time}) ?',
    composerDraftContinue: 'Reprendre',
    composerDraftDiscard: 'Supprimer',
    composerDraftConflict: 'Ce brouillon a été modifié sur un autre appareil ({time}).',
    composerDraftUseSaved: 'Prendre cette version',
    composerDraftKeepThis: 'Garder cette version',
    composerDraftGone: 'Ce brouillon a été publié ou supprimé sur un autre appareil.',
    composerDraftKeepWriting: 'Continuer à l’écrire',
    composerDraftClear: 'L’effacer',
  },
};

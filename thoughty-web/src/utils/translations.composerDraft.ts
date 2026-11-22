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
  | 'composerDraftClear'
  | 'offlineNotice'
  | 'offlineNoticeDetail'
  | 'sessionUnreachableTitle'
  | 'sessionUnreachableDetail';

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
    offlineNotice: 'You’re offline',
    offlineNoticeDetail: 'You can keep writing: your draft stays on this device and is saved once Thoughty can be reached again.',
    sessionUnreachableTitle: 'Thoughty can’t be reached right now',
    sessionUnreachableDetail: 'You’re still signed in. Your journal opens as soon as Thoughty answers; it tries again on its own.',
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
    offlineNotice: 'Vous êtes hors ligne',
    offlineNoticeDetail: 'Vous pouvez continuer à écrire : votre brouillon reste sur cet appareil et sera enregistré dès que Thoughty sera de nouveau joignable.',
    sessionUnreachableTitle: 'Thoughty est injoignable pour le moment',
    sessionUnreachableDetail: 'Votre session est toujours ouverte. Votre journal s’ouvre dès que Thoughty répond ; il réessaie de lui-même.',
  },
};

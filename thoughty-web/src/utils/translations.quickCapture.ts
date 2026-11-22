import type { Language } from './translations';

/** Quick capture, and what is shared to the installed app from another one. */
export type QuickCaptureTranslationKey =
  | 'quickCapture'
  | 'quickCaptureHint'
  | 'quickCaptureDescription'
  | 'quickCaptureKeysHint'
  | 'quickCaptureOpenInFull'
  | 'quickCaptureSaving'
  | 'quickCaptureSaved'
  | 'quickCaptureViewEntry'
  | 'shareTargetReplaceMessage';

export const quickCaptureTranslations: Record<Language, Record<QuickCaptureTranslationKey, string>> = {
  en: {
    quickCapture: 'Quick capture',
    quickCaptureHint: 'Quick capture (Ctrl+Shift+Space)',
    quickCaptureDescription: 'Your note is saved as a private entry for today in your default diary.',
    quickCaptureKeysHint: 'Enter adds a line · Ctrl+Enter saves',
    quickCaptureOpenInFull: 'Open in full',
    quickCaptureSaving: 'Saving...',
    quickCaptureSaved: 'Saved as a private entry for today.',
    quickCaptureViewEntry: 'View entry',
    shareTargetReplaceMessage:
      'The new entry form already holds a draft. What you shared to Thoughty replaces its text, title, tags, time and mood, in a private entry dated today.',
  },
  fr: {
    quickCapture: 'Capture rapide',
    quickCaptureHint: 'Capture rapide (Ctrl+Maj+Espace)',
    quickCaptureDescription: 'Votre note est enregistrée comme entrée privée du jour dans votre journal par défaut.',
    quickCaptureKeysHint: 'Entrée ajoute une ligne · Ctrl+Entrée enregistre',
    quickCaptureOpenInFull: 'Ouvrir dans l’éditeur',
    quickCaptureSaving: 'Enregistrement...',
    quickCaptureSaved: 'Enregistrée comme entrée privée du jour.',
    quickCaptureViewEntry: 'Voir l’entrée',
    shareTargetReplaceMessage:
      'Le formulaire de nouvelle entrée contient déjà un brouillon. Ce que vous avez partagé avec Thoughty remplace son texte, son titre, ses tags, son heure et son humeur, dans une entrée privée à la date d’aujourd’hui.',
  },
};

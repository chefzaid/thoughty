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
  | 'shareTargetReplaceMessage'
  | 'shareTargetFilesReplaceMessage'
  | 'shareTargetFilesLost'
  | 'shareTargetNotReceived';

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
    shareTargetFilesReplaceMessage:
      'The new entry form already holds a draft. What you shared to Thoughty replaces its text, title, tags, time and mood, in a private entry dated today, and the files you shared are attached to it.',
    shareTargetFilesLost: 'The files you shared to Thoughty could not be received. Please share them again.',
    shareTargetNotReceived: 'Thoughty could not receive what you shared. Open Thoughty once, then share it again.',
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
    shareTargetFilesReplaceMessage:
      'Le formulaire de nouvelle entrée contient déjà un brouillon. Ce que vous avez partagé avec Thoughty remplace son texte, son titre, ses tags, son heure et son humeur, dans une entrée privée à la date d’aujourd’hui, et les fichiers partagés y sont joints.',
    shareTargetFilesLost: 'Les fichiers partagés avec Thoughty n’ont pas pu être reçus. Partagez-les à nouveau.',
    shareTargetNotReceived: 'Thoughty n’a pas pu recevoir ce que vous avez partagé. Ouvrez Thoughty une fois, puis partagez-le à nouveau.',
  },
};

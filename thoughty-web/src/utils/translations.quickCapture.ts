import type { Language } from './translations';

export type QuickCaptureTranslationKey =
  | 'quickCapture'
  | 'quickCaptureHint'
  | 'quickCaptureDescription'
  | 'quickCaptureOpenInFull'
  | 'quickCaptureSaving'
  | 'quickCaptureSaved'
  | 'quickCaptureViewEntry';

export const quickCaptureTranslations: Record<Language, Record<QuickCaptureTranslationKey, string>> = {
  en: {
    quickCapture: 'Quick capture',
    quickCaptureHint: 'Quick capture (Ctrl+Shift+Space)',
    quickCaptureDescription: 'Enter saves it as a private entry for today in your default diary.',
    quickCaptureOpenInFull: 'Open in full',
    quickCaptureSaving: 'Saving...',
    quickCaptureSaved: 'Saved as a private entry for today.',
    quickCaptureViewEntry: 'View entry',
  },
  fr: {
    quickCapture: 'Capture rapide',
    quickCaptureHint: 'Capture rapide (Ctrl+Maj+Espace)',
    quickCaptureDescription: 'La touche Entrée l’enregistre comme entrée privée du jour dans votre journal par défaut.',
    quickCaptureOpenInFull: 'Ouvrir dans l’éditeur',
    quickCaptureSaving: 'Enregistrement...',
    quickCaptureSaved: 'Enregistrée comme entrée privée du jour.',
    quickCaptureViewEntry: 'Voir l’entrée',
  },
};

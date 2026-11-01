import type { Language } from './translations';

export type DictationTranslationKey =
  | 'dictation'
  | 'dictationHint'
  | 'dictationNotice'
  | 'dictationNoticeStart'
  | 'dictationNoticeCancel'
  | 'dictationStarted'
  | 'dictationStopped'
  | 'dictationListening'
  | 'dictationErrorDenied'
  | 'dictationErrorService'
  | 'dictationErrorNoMicrophone'
  | 'dictationErrorNoSpeech'
  | 'dictationErrorNetwork'
  | 'dictationErrorLanguage'
  | 'dictationErrorFailed';

export const dictationTranslations: Record<Language, Record<DictationTranslationKey, string>> = {
  en: {
    dictation: 'Dictate',
    dictationHint: 'Dictate: speak and your words are written at the cursor. Escape stops.',
    dictationNotice: "Your browser turns speech into text; Chrome and some other browsers send the audio to their maker's speech service to do it.",
    dictationNoticeStart: 'Start dictating',
    dictationNoticeCancel: 'Cancel',
    dictationStarted: 'Dictation on. Speak to write; Escape stops.',
    dictationStopped: 'Dictation off.',
    dictationListening: 'Listening…',
    dictationErrorDenied: "Microphone access was refused. Allow the microphone for this site in your browser's settings to dictate.",
    dictationErrorService: "This browser's speech service is not available here, so dictation cannot start.",
    dictationErrorNoMicrophone: 'No microphone was found.',
    dictationErrorNoSpeech: 'No speech was heard, so dictation stopped.',
    dictationErrorNetwork: "The browser's speech service could not be reached. Check the connection and try again.",
    dictationErrorLanguage: 'This browser cannot recognize speech in this language.',
    dictationErrorFailed: 'Dictation stopped because of an error. Try again.',
  },
  fr: {
    dictation: 'Dicter',
    dictationHint: 'Dicter : parlez et vos mots s’écrivent au curseur. Échap arrête.',
    dictationNotice: 'Votre navigateur transforme la parole en texte ; Chrome et d’autres navigateurs envoient pour cela l’audio au service de reconnaissance vocale de leur éditeur.',
    dictationNoticeStart: 'Commencer la dictée',
    dictationNoticeCancel: 'Annuler',
    dictationStarted: 'Dictée activée. Parlez pour écrire ; Échap l’arrête.',
    dictationStopped: 'Dictée arrêtée.',
    dictationListening: 'À l’écoute…',
    dictationErrorDenied: 'L’accès au micro a été refusé. Autorisez le micro pour ce site dans les réglages du navigateur pour dicter.',
    dictationErrorService: 'Le service de reconnaissance vocale de ce navigateur n’est pas disponible ici : la dictée ne peut pas démarrer.',
    dictationErrorNoMicrophone: 'Aucun micro n’a été trouvé.',
    dictationErrorNoSpeech: 'Aucune parole n’a été entendue : la dictée s’est arrêtée.',
    dictationErrorNetwork: 'Le service de reconnaissance vocale du navigateur est injoignable. Vérifiez la connexion et réessayez.',
    dictationErrorLanguage: 'Ce navigateur ne reconnaît pas la parole dans cette langue.',
    dictationErrorFailed: 'La dictée s’est arrêtée à cause d’une erreur. Réessayez.',
  },
};

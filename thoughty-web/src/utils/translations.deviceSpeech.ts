import type { Language } from './translations';
import type { DeviceSpeechProblem } from '../services/speech/speechProtocol';

export type DeviceSpeechTranslationKey =
  | DeviceSpeechProblem
  | 'deviceSpeechQueued'
  | 'deviceSpeechPreparing'
  | 'deviceSpeechDownloading'
  | 'deviceSpeechDownloadLabel'
  | 'deviceSpeechTranscribing'
  | 'deviceSpeechRetry';

/** Recordings transcribed on the writer's device, in the diaries set to "My own model only". */
export const deviceSpeechTranslations: Record<Language, Record<DeviceSpeechTranslationKey, string>> = {
  en: {
    deviceSpeechQueued: 'Waiting to be transcribed on this device…',
    deviceSpeechPreparing: 'Getting speech recognition ready on this device…',
    deviceSpeechDownloading: 'Downloading the speech-recognition model to this device (first time only): {loaded} of {total} MB',
    deviceSpeechDownloadLabel: 'Speech-recognition model download',
    deviceSpeechTranscribing: 'Transcribing on this device…',
    deviceSpeechRetry: 'Try again',
    deviceSpeechUnsupported:
      'This browser cannot transcribe recordings on this device: it needs WebAssembly, Web Workers and Web Audio. Try a recent browser, on a computer if this phone or tablet cannot.',
    deviceSpeechDownloadFailed: 'The speech-recognition model could not be downloaded to this device. Check your connection and try again.',
    deviceSpeechOutOfMemory: 'This device ran out of memory transcribing the recording. Close other tabs or apps and try again, or try on a computer.',
    deviceSpeechUnreadableAudio: 'This browser cannot read the recording’s format to transcribe it. Try another browser.',
    deviceSpeechNoWords: 'No words were heard in this recording.',
    deviceSpeechRecordingUnavailable: 'This recording could not be loaded from Thoughty to transcribe it. Try again.',
    deviceSpeechFailed: 'The recording could not be transcribed on this device. Try again.',
  },
  fr: {
    deviceSpeechQueued: 'En attente de transcription sur cet appareil…',
    deviceSpeechPreparing: 'Préparation de la reconnaissance vocale sur cet appareil…',
    deviceSpeechDownloading: 'Téléchargement du modèle de reconnaissance vocale sur cet appareil (la première fois seulement) : {loaded} sur {total} Mo',
    deviceSpeechDownloadLabel: 'Téléchargement du modèle de reconnaissance vocale',
    deviceSpeechTranscribing: 'Transcription sur cet appareil…',
    deviceSpeechRetry: 'Réessayer',
    deviceSpeechUnsupported:
      "Ce navigateur ne peut pas transcrire les enregistrements sur cet appareil : il lui faut WebAssembly, les Web Workers et Web Audio. Essayez un navigateur récent, sur un ordinateur si ce téléphone ou cette tablette n'y arrive pas.",
    deviceSpeechDownloadFailed: "Le modèle de reconnaissance vocale n'a pas pu être téléchargé sur cet appareil. Vérifiez votre connexion et réessayez.",
    deviceSpeechOutOfMemory: "Cet appareil a manqué de mémoire pour transcrire l'enregistrement. Fermez d'autres onglets ou applications et réessayez, ou essayez sur un ordinateur.",
    deviceSpeechUnreadableAudio: "Ce navigateur ne sait pas lire le format de cet enregistrement pour le transcrire. Essayez un autre navigateur.",
    deviceSpeechNoWords: "Aucun mot n'a été entendu dans cet enregistrement.",
    deviceSpeechRecordingUnavailable: "Cet enregistrement n'a pas pu être chargé depuis Thoughty pour le transcrire. Réessayez.",
    deviceSpeechFailed: "L'enregistrement n'a pas pu être transcrit sur cet appareil. Réessayez.",
  },
};

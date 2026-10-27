import type { Language } from './translations';

/** Video attachments, and the kind of file each attachment card names. */
export type VideoAttachmentsTranslationKey =
  | 'attachmentKindImage'
  | 'attachmentKindAudio'
  | 'attachmentKindVideo'
  | 'attachmentKindPdf'
  | 'attachmentKindText'
  | 'attachmentKindFile'
  | 'attachmentVideoTooLarge'
  | 'videoPlay'
  | 'videoLoading'
  | 'videoLoadFailed'
  | 'videoRetry'
  | 'videoUnsupported';

export const videoAttachmentsTranslations: Record<Language, Record<VideoAttachmentsTranslationKey, string>> = {
  en: {
    attachmentKindImage: 'Image',
    attachmentKindAudio: 'Audio',
    attachmentKindVideo: 'Video',
    attachmentKindPdf: 'PDF',
    attachmentKindText: 'Text',
    attachmentKindFile: 'File',
    attachmentVideoTooLarge: 'Video is too large. Maximum size is 50 MB.',
    videoPlay: 'Play the video {name}',
    videoLoading: 'Loading the video {name}…',
    videoLoadFailed: 'The video {name} could not be loaded.',
    videoRetry: 'Try again',
    videoUnsupported: 'This browser cannot play this video. Download it to watch it.',
  },
  fr: {
    attachmentKindImage: 'Image',
    attachmentKindAudio: 'Audio',
    attachmentKindVideo: 'Vidéo',
    attachmentKindPdf: 'PDF',
    attachmentKindText: 'Texte',
    attachmentKindFile: 'Fichier',
    attachmentVideoTooLarge: 'La vidéo est trop volumineuse. Taille maximale : 50 Mo.',
    videoPlay: 'Lire la vidéo {name}',
    videoLoading: 'Chargement de la vidéo {name}…',
    videoLoadFailed: 'La vidéo {name} n’a pas pu être chargée.',
    videoRetry: 'Réessayer',
    videoUnsupported: 'Ce navigateur ne peut pas lire cette vidéo. Téléchargez-la pour la regarder.',
  },
};

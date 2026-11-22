import type { Language } from './translations';

/** Photo prompts on the Memoir page: an old photo and the story of what is happening in it. */
export type MemoirPhotosTranslationKey =
  | 'memoirPhotoTitle'
  | 'memoirPhotoIntro'
  | 'memoirPhotoStart'
  | 'memoirPhotoChoose'
  | 'memoirPhotoChooseAnother'
  | 'memoirPhotoChosen'
  | 'memoirPhotoPreviewAlt'
  | 'memoirPhotoQuestion'
  | 'memoirPhotoStoryPlaceholder'
  | 'memoirPhotoCaption'
  | 'memoirPhotoCaptionHint'
  | 'memoirPhotoChapter'
  | 'memoirPhotoChapterNone'
  | 'memoirPhotoChapterHint'
  | 'memoirPhotoSave'
  | 'memoirPhotoSaved'
  | 'memoirPhotoMissing'
  | 'memoirPhotoNotImage'
  | 'memoirPhotoTooLarge'
  | 'memoirPhotoUploadError'
  | 'memoirPhotoStoryEmpty'
  | 'memoirPhotoSaveError'
  | 'memoirPhotoStories'
  | 'memoirPhotoStoryOn'
  | 'memoirPhotoOpen';

export const memoirPhotosTranslations: Record<Language, Record<MemoirPhotosTranslationKey, string>> = {
  en: {
    memoirPhotoTitle: 'Photo prompts',
    memoirPhotoIntro: 'Upload an old photo and tell what is happening in it. Your book places the photo next to your story.',
    memoirPhotoStart: 'Tell a photo’s story',
    memoirPhotoChoose: 'Choose a photo',
    memoirPhotoChooseAnother: 'Choose another photo',
    memoirPhotoChosen: 'Chosen photo: {name}',
    memoirPhotoPreviewAlt: 'The chosen photo',
    memoirPhotoQuestion: 'What is happening here?',
    memoirPhotoStoryPlaceholder: 'Who is there, where and when it was, what happened before and after…',
    memoirPhotoCaption: 'Describe the photo (optional)',
    memoirPhotoCaptionHint: 'Shown under the photo in your book and read aloud by screen readers, such as “The bakery on Rue Saint-Jean, 1962”.',
    memoirPhotoChapter: 'Life chapter',
    memoirPhotoChapterNone: 'Photos (a chapter of their own)',
    memoirPhotoChapterHint: 'The story is tagged with this chapter, so your book places it there.',
    memoirPhotoSave: 'Save the story',
    memoirPhotoSaved: 'Photo story saved to your memoir.',
    memoirPhotoMissing: 'Choose a photo first.',
    memoirPhotoNotImage: 'Choose a JPEG, PNG, GIF or WebP picture.',
    memoirPhotoTooLarge: 'This photo is larger than 5 MB.',
    memoirPhotoUploadError: 'The photo could not be uploaded.',
    memoirPhotoStoryEmpty: 'Tell what is happening in the photo.',
    memoirPhotoSaveError: 'Your photo story could not be saved.',
    memoirPhotoStories: 'Your photo stories',
    memoirPhotoStoryOn: 'Photo story of {date}',
    memoirPhotoOpen: 'Read in journal',
  },
  fr: {
    memoirPhotoTitle: 'Questions photo',
    memoirPhotoIntro: 'Ajoutez une ancienne photo et racontez ce qui s’y passe. Votre livre place la photo à côté de votre récit.',
    memoirPhotoStart: 'Raconter une photo',
    memoirPhotoChoose: 'Choisir une photo',
    memoirPhotoChooseAnother: 'Choisir une autre photo',
    memoirPhotoChosen: 'Photo choisie : {name}',
    memoirPhotoPreviewAlt: 'La photo choisie',
    memoirPhotoQuestion: 'Que se passe-t-il ici ?',
    memoirPhotoStoryPlaceholder: 'Qui est là, où et quand c’était, ce qui s’est passé avant et après…',
    memoirPhotoCaption: 'Décrire la photo (facultatif)',
    memoirPhotoCaptionHint: 'Affiché sous la photo dans votre livre et lu par les lecteurs d’écran, par exemple « La boulangerie de la rue Saint-Jean, 1962 ».',
    memoirPhotoChapter: 'Chapitre de vie',
    memoirPhotoChapterNone: 'Photos (un chapitre à part)',
    memoirPhotoChapterHint: 'Le récit porte le tag de ce chapitre, pour que votre livre l’y place.',
    memoirPhotoSave: 'Enregistrer le récit',
    memoirPhotoSaved: 'Récit photo ajouté à vos mémoires.',
    memoirPhotoMissing: 'Choisissez d’abord une photo.',
    memoirPhotoNotImage: 'Choisissez une image JPEG, PNG, GIF ou WebP.',
    memoirPhotoTooLarge: 'Cette photo dépasse 5 Mo.',
    memoirPhotoUploadError: 'La photo n’a pas pu être envoyée.',
    memoirPhotoStoryEmpty: 'Racontez ce qui se passe sur la photo.',
    memoirPhotoSaveError: 'Votre récit photo n’a pas pu être enregistré.',
    memoirPhotoStories: 'Vos récits photo',
    memoirPhotoStoryOn: 'Récit photo du {date}',
    memoirPhotoOpen: 'Lire dans le journal',
  },
};

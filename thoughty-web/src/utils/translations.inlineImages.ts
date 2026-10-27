import type { Language } from './translations';

export type InlineImagesTranslationKey =
  | 'markdownToolbarInlineImage'
  | 'markdownHelpInlineImage'
  | 'insertImage'
  | 'insertImageFor'
  | 'insertImageTitle'
  | 'insertImageDescription'
  | 'insertImageChoose'
  | 'insertImageAlt'
  | 'insertImageAltHint'
  | 'insertImageConfirm'
  | 'insertImageNone'
  | 'inlineImageOpen'
  | 'inlineImageLoading'
  | 'inlineImageMissing';

export const inlineImagesTranslations: Record<Language, Record<InlineImagesTranslationKey, string>> = {
  en: {
    markdownToolbarInlineImage: 'Insert one of the attached pictures',
    markdownHelpInlineImage: 'one of the entry’s pictures, placed here (Insert in text, under the picture)',
    insertImage: 'Insert in text',
    insertImageFor: 'Insert {name} in the text',
    insertImageTitle: 'Insert a picture',
    insertImageDescription: 'The picture goes where the cursor is in your text.',
    insertImageChoose: 'Picture',
    insertImageAlt: 'Description (alt text)',
    insertImageAltHint: 'What the picture shows, for people who cannot see it. Leave empty for a decorative picture.',
    insertImageConfirm: 'Insert',
    insertImageNone: 'Attach a picture to this entry first, with the paperclip button.',
    inlineImageOpen: 'Open the picture {name}',
    inlineImageLoading: 'Loading the picture {name}',
    inlineImageMissing: 'Picture no longer available',
  },
  fr: {
    markdownToolbarInlineImage: 'Insérer une des images jointes',
    markdownHelpInlineImage: 'une des images de l’entrée, placée ici (Insérer dans le texte, sous l’image)',
    insertImage: 'Insérer dans le texte',
    insertImageFor: 'Insérer {name} dans le texte',
    insertImageTitle: 'Insérer une image',
    insertImageDescription: 'L’image se place là où se trouve le curseur dans votre texte.',
    insertImageChoose: 'Image',
    insertImageAlt: 'Description (texte alternatif)',
    insertImageAltHint: 'Ce que montre l’image, pour les personnes qui ne la voient pas. Laissez vide pour une image décorative.',
    insertImageConfirm: 'Insérer',
    insertImageNone: 'Joignez d’abord une image à cette entrée, avec le bouton trombone.',
    inlineImageOpen: 'Ouvrir l’image {name}',
    inlineImageLoading: 'Chargement de l’image {name}',
    inlineImageMissing: 'Image plus disponible',
  },
};

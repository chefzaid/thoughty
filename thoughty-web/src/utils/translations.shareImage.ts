import type { Language } from './translations';

/** Sharing an entry as an image card: the menu item, the dialog's options, and its messages. */
export type ShareImageTranslationKey =
  | "shareAsImage"
  | "shareAsImageBy"
  | "shareImageText"
  | "shareImageTextHint"
  | "shareImageUseWholeEntry"
  | "shareImageIncludeTitle"
  | "shareImageShowMark"
  | "shareImageColors"
  | "shareImageThemeLight"
  | "shareImageThemeDark"
  | "shareImageThemeViolet"
  | "shareImageSize"
  | "shareImageSizeSquare"
  | "shareImageSizePortrait"
  | "shareImagePreviewAlt"
  | "shareImagePrivateNote"
  | "shareImageEmpty"
  | "shareImageUnsupported"
  | "shareImageDownload"
  | "shareImageCopy"
  | "shareImageShare"
  | "shareImageDownloaded"
  | "shareImageCopied"
  | "shareImageShared"
  | "shareImageCopyFailed"
  | "shareImageShareFailed"
  | "shareImageExportFailed";

export const shareImageTranslations: Record<Language, Record<ShareImageTranslationKey, string>> = {
  en: {
    shareAsImage: "Share as image",
    shareAsImageBy: "Share the entry of {date} as an image",
    shareImageText: "Text on the card",
    shareImageTextHint: "Keep the whole entry or trim it to the excerpt you want to post. Text that does not fit ends with an ellipsis.",
    shareImageUseWholeEntry: "Use the whole entry",
    shareImageIncludeTitle: "Show the title",
    shareImageShowMark: "Show the “— Thoughty” mark",
    shareImageColors: "Colors",
    shareImageThemeLight: "Light",
    shareImageThemeDark: "Dark",
    shareImageThemeViolet: "Violet",
    shareImageSize: "Size",
    shareImageSizeSquare: "Square",
    shareImageSizePortrait: "Portrait",
    shareImagePreviewAlt: "Image card preview: “{text}”, {date}",
    shareImagePrivateNote: "This entry is private. Anyone who sees the image can read the text on it.",
    shareImageEmpty: "Add some text to put on the card.",
    shareImageUnsupported: "This browser cannot copy or share images. Download the PNG to post it.",
    shareImageDownload: "Download PNG",
    shareImageCopy: "Copy image",
    shareImageShare: "Share…",
    shareImageDownloaded: "Image downloaded.",
    shareImageCopied: "Image copied to the clipboard.",
    shareImageShared: "Image shared.",
    shareImageCopyFailed: "The image could not be copied. Download it instead.",
    shareImageShareFailed: "The image could not be shared. Download it instead.",
    shareImageExportFailed: "The image could not be created.",
  },
  fr: {
    shareAsImage: "Partager en image",
    shareAsImageBy: "Partager l'entrée du {date} en image",
    shareImageText: "Texte de la carte",
    shareImageTextHint: "Gardez toute l'entrée ou réduisez-la à l'extrait que vous voulez publier. Le texte qui ne tient pas se termine par des points de suspension.",
    shareImageUseWholeEntry: "Reprendre toute l'entrée",
    shareImageIncludeTitle: "Afficher le titre",
    shareImageShowMark: "Afficher la mention « — Thoughty »",
    shareImageColors: "Couleurs",
    shareImageThemeLight: "Clair",
    shareImageThemeDark: "Sombre",
    shareImageThemeViolet: "Violet",
    shareImageSize: "Format",
    shareImageSizeSquare: "Carré",
    shareImageSizePortrait: "Portrait",
    shareImagePreviewAlt: "Aperçu de la carte image : « {text} », {date}",
    shareImagePrivateNote: "Cette entrée est privée. Toute personne qui voit l'image peut en lire le texte.",
    shareImageEmpty: "Ajoutez du texte à mettre sur la carte.",
    shareImageUnsupported: "Ce navigateur ne peut ni copier ni partager d'images. Téléchargez le PNG pour le publier.",
    shareImageDownload: "Télécharger le PNG",
    shareImageCopy: "Copier l'image",
    shareImageShare: "Partager…",
    shareImageDownloaded: "Image téléchargée.",
    shareImageCopied: "Image copiée dans le presse-papiers.",
    shareImageShared: "Image partagée.",
    shareImageCopyFailed: "Impossible de copier l'image. Téléchargez-la plutôt.",
    shareImageShareFailed: "Impossible de partager l'image. Téléchargez-la plutôt.",
    shareImageExportFailed: "Impossible de créer l'image.",
  },
};

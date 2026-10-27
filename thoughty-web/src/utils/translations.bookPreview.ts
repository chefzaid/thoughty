import type { Language } from './translations';

/** The book converter's page-by-page preview of the generated PDF. */
export type BookPreviewTranslationKey =
  | "bookPagePreview"
  | "bookPagePreviewAiNotice"
  | "bookPagePreviewTitle"
  | "bookPagePreviewGenerating"
  | "bookPagePreviewOpening"
  | "bookPagePreviewOpenError"
  | "bookPagePreviewFormatNotice"
  | "bookPagePreviewControls"
  | "bookPagePreviewPage"
  | "bookPagePreviewPrevious"
  | "bookPagePreviewNext"
  | "bookPagePreviewJump"
  | "bookPagePreviewTitlePage"
  | "bookPagePreviewContents"
  | "bookPagePreviewChapterOption"
  | "bookPagePreviewZoomIn"
  | "bookPagePreviewZoomOut"
  | "bookPagePreviewZoomLevel"
  | "bookPagePreviewFit"
  | "bookPagePreviewDownload"
  | "bookPagePreviewKeyboardHint";

export const bookPreviewTranslations: Record<Language, Record<BookPreviewTranslationKey, string>> = {
  en: {
    bookPagePreview: "Preview Book",
    bookPagePreviewAiNotice:
      "AI writing is on, so the preview writes the book with your AI provider and uses AI tokens. Downloading the PDF from the preview, or with Download Book while the settings stay the same, reuses that book instead of writing it again.",
    bookPagePreviewTitle: "Book preview",
    bookPagePreviewGenerating: "Generating the book...",
    bookPagePreviewOpening: "Opening the pages...",
    bookPagePreviewOpenError: "The pages could not be shown. You can still download the PDF.",
    bookPagePreviewFormatNotice:
      "The preview shows the PDF edition. Download PDF saves it as shown; Download Book saves the {format} edition.",
    bookPagePreviewControls: "Page controls",
    bookPagePreviewPage: "Page {page} of {count}",
    bookPagePreviewPrevious: "Previous page",
    bookPagePreviewNext: "Next page",
    bookPagePreviewJump: "Go to",
    bookPagePreviewTitlePage: "Title page",
    bookPagePreviewContents: "Table of contents",
    bookPagePreviewChapterOption: "{title} (page {page})",
    bookPagePreviewZoomIn: "Zoom in",
    bookPagePreviewZoomOut: "Zoom out",
    bookPagePreviewZoomLevel: "{percent}%",
    bookPagePreviewFit: "Fit page",
    bookPagePreviewDownload: "Download PDF",
    bookPagePreviewKeyboardHint:
      "Left and right arrows or Page Up and Page Down turn the pages, Home and End go to the first and last page, plus and minus zoom, and 0 fits the page.",
  },
  fr: {
    bookPagePreview: "Aperçu du livre",
    bookPagePreviewAiNotice:
      "L'écriture par IA est activée : l'aperçu écrit le livre avec votre fournisseur d'IA et consomme des jetons. Télécharger le PDF depuis l'aperçu, ou avec Télécharger le livre tant que les réglages ne changent pas, réutilise ce livre au lieu de l'écrire à nouveau.",
    bookPagePreviewTitle: "Aperçu du livre",
    bookPagePreviewGenerating: "Génération du livre...",
    bookPagePreviewOpening: "Ouverture des pages...",
    bookPagePreviewOpenError: "Les pages n'ont pas pu être affichées. Vous pouvez quand même télécharger le PDF.",
    bookPagePreviewFormatNotice:
      "L'aperçu montre l'édition PDF. Télécharger le PDF l'enregistre telle quelle ; Télécharger le livre enregistre l'édition {format}.",
    bookPagePreviewControls: "Commandes des pages",
    bookPagePreviewPage: "Page {page} sur {count}",
    bookPagePreviewPrevious: "Page précédente",
    bookPagePreviewNext: "Page suivante",
    bookPagePreviewJump: "Aller à",
    bookPagePreviewTitlePage: "Page de titre",
    bookPagePreviewContents: "Table des matières",
    bookPagePreviewChapterOption: "{title} (page {page})",
    bookPagePreviewZoomIn: "Zoom avant",
    bookPagePreviewZoomOut: "Zoom arrière",
    bookPagePreviewZoomLevel: "{percent} %",
    bookPagePreviewFit: "Ajuster la page",
    bookPagePreviewDownload: "Télécharger le PDF",
    bookPagePreviewKeyboardHint:
      "Les flèches gauche et droite ou Page précédente et Page suivante tournent les pages, Début et Fin vont à la première et à la dernière page, plus et moins zooment, et 0 ajuste la page.",
  },
};

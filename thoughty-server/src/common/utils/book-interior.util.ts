/**
 * Interior themes of a book: the type, margins, chapter openers and photo layout of its pages, in the
 * PDF (the preview and the printed book) and, through a few style rules, in the HTML and EPUB.
 */
export const BOOK_INTERIOR_THEMES = ['standard', 'elegant', 'large-print'] as const;

export type BookInteriorTheme = (typeof BOOK_INTERIOR_THEMES)[number];

export interface BookPdfFonts {
  regular: string;
  bold: string;
  italic: string;
}

export interface BookInteriorStyle {
  /** PDFKit standard fonts, which need no embedding. */
  fonts: BookPdfFonts;
  /** The page margin on every side, in points. */
  margin: number;
  titleSize: number;
  chapterSize: number;
  entryTitleSize: number;
  bodySize: number;
  dateSize: number;
  framingSize: number;
  frontPageSize: number;
  /** Extra space between the lines of running text, in points. */
  lineGap: number;
  /** Justified text, or ragged right, which is easier to follow in large type. */
  align: 'justify' | 'left';
  /** Chapters open at the top of their page, left; or a quarter of the way down, centred, under a short rule. */
  chapterOpener: 'top' | 'centered';
  /** A photo's share of the text width, centred, and the height its frame takes on the page. */
  photoWidth: number;
  photoHeight: number;
  /** Style rules added after the HTML and EPUB's own; empty keeps their look. */
  css: string;
}

const HELVETICA: BookPdfFonts = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };
const TIMES: BookPdfFonts = { regular: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic' };

export const BOOK_INTERIOR_STYLES: Record<BookInteriorTheme, BookInteriorStyle> = {
  standard: {
    fonts: HELVETICA,
    margin: 72,
    titleSize: 28,
    chapterSize: 20,
    entryTitleSize: 12,
    bodySize: 11,
    dateSize: 9,
    framingSize: 10,
    frontPageSize: 13,
    lineGap: 2,
    align: 'justify',
    chapterOpener: 'top',
    photoWidth: 1,
    photoHeight: 220,
    css: '',
  },
  elegant: {
    fonts: TIMES,
    margin: 90,
    titleSize: 30,
    chapterSize: 22,
    entryTitleSize: 13,
    bodySize: 12,
    dateSize: 10,
    framingSize: 11,
    frontPageSize: 14,
    lineGap: 3,
    align: 'justify',
    chapterOpener: 'centered',
    photoWidth: 0.7,
    photoHeight: 210,
    css: [
      'body{font-family:Georgia,"Times New Roman",serif;text-align:justify}',
      '.chapter h2{text-align:center;border-bottom:0;padding-top:4em;font-weight:normal;letter-spacing:0.04em}',
      '.chapter h2::after{content:"";display:block;width:4em;margin:0.8em auto 0;border-bottom:1px solid #999}',
      '.entry-image img{max-width:70%}',
    ].join('\n'),
  },
  'large-print': {
    fonts: HELVETICA,
    margin: 60,
    titleSize: 34,
    chapterSize: 26,
    entryTitleSize: 17,
    bodySize: 15,
    dateSize: 12,
    framingSize: 14,
    frontPageSize: 17,
    lineGap: 5,
    align: 'left',
    chapterOpener: 'top',
    photoWidth: 1,
    photoHeight: 300,
    css: [
      'body{font-family:Verdana,Arial,Helvetica,sans-serif;font-size:1.3em;line-height:1.8;text-align:left}',
      '.entry-date,.entry-image figcaption{font-size:0.95em}',
    ].join('\n'),
  },
};

/** The style of a book's interior; the standard one without a theme. */
export function bookInteriorStyle(theme?: BookInteriorTheme): BookInteriorStyle {
  return BOOK_INTERIOR_STYLES[theme ?? 'standard'];
}

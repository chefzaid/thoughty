import PDFDocument from 'pdfkit';
import {
  Book,
  formatBookEntryDate,
  RenderBookOptions,
  stripMarkdown,
} from './book-converter.util';
import { BOOK_COVER_PALETTES } from './book-cover-style.util';
import type { EmbeddedBookImage } from './book-image.util';
import { inlineImageCaption, layoutBookEntry } from './book-inline-image.util';
import { bookClosingPageLines } from './book-pages.util';
import { bookCopy, formatBookDate, type BookLanguage } from './book-language.util';
import { bookInteriorStyle, type BookInteriorStyle } from './book-interior.util';

const FOOTER_OFFSET = 40;
const TOC_LINE_GAP = 6;
const TOC_PAGE_NUM_WIDTH = 40;
const PAGE_NUMBER_FONT_SIZE = 9;
const CHAPTER_RULE_WIDTH = 60;

/**
 * The named destinations a book's own pages carry, so a reader (the app's page preview among them)
 * can tell which page is which; chapters are in the outline.
 */
export const BOOK_PDF_DESTINATIONS = {
  dedication: 'dedication',
  epigraph: 'epigraph',
  contents: 'contents',
  about: 'about',
} as const;

interface TocLinePosition {
  pageIndex: number;
  y: number;
}

function renderTitlePage(doc: PDFKit.PDFDocument, book: Book, style: BookInteriorStyle): void {
  const palette = BOOK_COVER_PALETTES[book.cover?.theme ?? 'classic'];
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(palette.background);
  doc.rect(0, 0, doc.page.width, 12).fill(palette.accent);

  if (book.cover?.image) {
    doc.image(book.cover.image.data, style.margin, 72, {
      fit: [doc.page.width - style.margin * 2, 300],
      align: 'center',
      valign: 'center',
    });
    doc.y = 410;
  } else {
    doc.moveDown(8);
  }

  doc.fillColor(palette.foreground).font(style.fonts.bold).fontSize(style.titleSize).text(book.title, { align: 'center' });
  doc.moveDown(1);
  if (book.author) {
    doc.font(style.fonts.italic).fontSize(style.frontPageSize + 1).text(bookCopy(book.language).byAuthor(book.author), { align: 'center' });
    doc.moveDown(1);
  }
  doc.font(style.fonts.regular).fontSize(style.bodySize).fillColor(palette.accent).text(formatBookDate(book.generatedAt, book.language), { align: 'center' });
  doc.fillColor('#000000');
}

/**
 * The dedication or epigraph alone on a page, a third of the way down, in italics: a dedication
 * centred, an epigraph in a narrower column. Answers the page's index, which carries no page number.
 */
function renderFrontPage(doc: PDFKit.PDFDocument, kind: 'dedication' | 'epigraph', text: string, style: BookInteriorStyle): number {
  doc.addPage();
  doc.addNamedDestination(BOOK_PDF_DESTINATIONS[kind]);
  const pageIndex = doc.bufferedPageRange().count - 1;
  const inset = kind === 'epigraph' ? style.margin : 0;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right - inset * 2;
  doc.font(style.fonts.italic).fontSize(kind === 'dedication' ? style.frontPageSize + 1 : style.frontPageSize).fillColor('#333333');
  doc.text(text, doc.page.margins.left + inset, doc.page.height / 3, {
    width,
    align: kind === 'dedication' ? 'center' : 'left',
    lineGap: 3,
    paragraphGap: 8,
  });
  doc.fillColor('#000000');
  return pageIndex;
}

/**
 * Render the table of contents and record where each chapter line was drawn,
 * so the chapter page numbers can be filled in after the chapters are rendered.
 */
function renderTableOfContents(doc: PDFKit.PDFDocument, book: Book, style: BookInteriorStyle): TocLinePosition[] {
  doc.addPage();
  doc.addNamedDestination(BOOK_PDF_DESTINATIONS.contents);
  doc.font(style.fonts.bold).fontSize(style.chapterSize).text(bookCopy(book.language).tableOfContents);
  doc.moveDown(1);
  doc.font(style.fonts.regular).fontSize(style.bodySize);

  const positions: TocLinePosition[] = [];
  const titleWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right - TOC_PAGE_NUM_WIDTH;

  for (const [index, chapter] of book.chapters.entries()) {
    const lineHeight = doc.currentLineHeight() + TOC_LINE_GAP;
    if (doc.y + lineHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
    positions.push({ pageIndex: doc.bufferedPageRange().count - 1, y: doc.y });
    doc.text(`${index + 1}. ${chapter.title}`, doc.page.margins.left, doc.y, {
      lineGap: TOC_LINE_GAP,
      width: titleWidth,
    });
  }

  return positions;
}

function fillTocPageNumbers(
  doc: PDFKit.PDFDocument,
  positions: TocLinePosition[],
  chapterPageNumbers: number[],
  style: BookInteriorStyle,
): void {
  doc.font(style.fonts.regular).fontSize(style.bodySize).fillColor('#000000');
  for (const [index, position] of positions.entries()) {
    doc.switchToPage(position.pageIndex);
    doc.text(
      String(chapterPageNumbers[index]),
      doc.page.width - doc.page.margins.right - TOC_PAGE_NUM_WIDTH,
      position.y,
      { width: TOC_PAGE_NUM_WIDTH, align: 'right', lineBreak: false },
    );
  }
}

function renderChapterBody(
  doc: PDFKit.PDFDocument,
  chapter: Book['chapters'][number],
  includeDates: boolean,
  language: BookLanguage | undefined,
  style: BookInteriorStyle,
): void {
  if (chapter.narrative) {
    doc.font(style.fonts.regular).fontSize(style.bodySize).fillColor('#000000').text(chapter.narrative, {
      align: style.align,
      lineGap: style.lineGap,
      paragraphGap: 8,
    });
    for (const entry of chapter.entries) {
      renderEntryImages(doc, entry, language, style);
    }
    return;
  }

  for (const entry of chapter.entries) {
    if (includeDates) {
      doc.font(style.fonts.italic).fontSize(style.dateSize).fillColor('#888888').text(formatBookEntryDate(entry, language));
      doc.moveDown(0.3);
    }
    if (entry.place) {
      doc.font(style.fonts.italic).fontSize(style.dateSize).fillColor('#888888').text(entry.place);
      doc.moveDown(0.3);
    }
    if (entry.title) {
      doc.font(style.fonts.bold).fontSize(style.entryTitleSize).fillColor('#000000').text(entry.title);
      doc.moveDown(0.3);
    }
    const { segments, trailing } = layoutBookEntry(entry);
    for (const segment of segments) {
      // An inline image the PDF cannot draw (GIF, WebP) leaves its alt text, like one it has no data for
      if (segment.type === 'image' && drawEntryImage(doc, segment.image, inlineImageCaption(segment), style)) {
        continue;
      }
      const raw = segment.type === 'text' ? segment.text : segment.alt;
      const text = entry.format === 'markdown' ? stripMarkdown(raw) : raw;
      if (text.trim()) {
        doc.font(style.fonts.regular).fontSize(style.bodySize).fillColor('#000000').text(text.replace(/^\n+|\s+$/g, ''), {
          align: style.align,
          lineGap: style.lineGap,
        });
      }
    }
    doc.moveDown(1.2);
    renderEntryImages(doc, entry, language, style, trailing);
  }
}

function renderEntryImages(
  doc: PDFKit.PDFDocument,
  entry: Book['chapters'][number]['entries'][number],
  language: BookLanguage | undefined,
  style: BookInteriorStyle,
  images: EmbeddedBookImage[] = entry.images ?? [],
): void {
  for (const image of images) {
    drawEntryImage(doc, image, `${formatBookDate(entry.date, language)} - ${image.name}`, style);
  }
}

/**
 * Draws a JPEG or PNG centred in its share of the text width, with its caption below, on a new page
 * when it does not fit; false when it cannot.
 */
function drawEntryImage(doc: PDFKit.PDFDocument, image: EmbeddedBookImage, caption: string, style: BookInteriorStyle): boolean {
  if (!image.data || (image.mimeType !== 'image/jpeg' && image.mimeType !== 'image/png')) {
    return false;
  }

  if (doc.y + style.photoHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
  const imageY = doc.y;
  const textWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const width = textWidth * style.photoWidth;
  try {
    doc.image(image.data, doc.page.margins.left + (textWidth - width) / 2, imageY, {
      fit: [width, style.photoHeight - 30],
      align: 'center',
      valign: 'center',
    });
  } catch {
    return false;
  }
  doc.y = imageY + style.photoHeight - 22;
  doc.font(style.fonts.italic).fontSize(style.dateSize).fillColor('#666666')
    .text(caption, doc.page.margins.left, doc.y, { width: textWidth, align: 'center' });
  doc.fillColor('#000000').moveDown(1);
  return true;
}

function renderChapterFraming(doc: PDFKit.PDFDocument, heading: string, content: string, style: BookInteriorStyle): void {
  doc.font(style.fonts.bold).fontSize(style.bodySize).fillColor('#333333').text(heading);
  doc.moveDown(0.35);
  doc.font(style.fonts.italic).fontSize(style.framingSize).fillColor('#444444').text(content, {
    align: style.align,
    lineGap: style.lineGap,
  });
  doc.fillColor('#000000').moveDown(1.2);
}

/** The chapter's number and title: at the top left, or a quarter of the way down, centred above a short rule. */
function renderChapterOpener(doc: PDFKit.PDFDocument, numberLine: string, title: string, style: BookInteriorStyle): void {
  if (style.chapterOpener === 'top') {
    doc.font(style.fonts.bold).fontSize(style.chapterSize).text(numberLine);
    doc.moveDown(0.2);
    doc.fontSize(style.chapterSize - 4).text(title);
    doc.moveDown(1.5);
    return;
  }

  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.font(style.fonts.regular).fontSize(style.bodySize).fillColor('#666666')
    .text(numberLine.toUpperCase(), doc.page.margins.left, doc.page.height / 4, { width, align: 'center', characterSpacing: 2 });
  doc.moveDown(0.6);
  doc.font(style.fonts.regular).fontSize(style.chapterSize).fillColor('#000000').text(title, { width, align: 'center' });
  doc.moveDown(0.8);
  const ruleY = doc.y;
  const ruleX = (doc.page.width - CHAPTER_RULE_WIDTH) / 2;
  doc.moveTo(ruleX, ruleY).lineTo(ruleX + CHAPTER_RULE_WIDTH, ruleY).lineWidth(0.75).strokeColor('#999999').stroke();
  doc.x = doc.page.margins.left;
  doc.y = ruleY;
  doc.moveDown(3);
}

function renderChapter(
  doc: PDFKit.PDFDocument,
  chapter: Book['chapters'][number],
  chapterNumber: number,
  includeDates: boolean,
  language: BookLanguage | undefined,
  style: BookInteriorStyle,
): number {
  const copy = bookCopy(language);
  doc.addPage();
  const startPageNumber = doc.bufferedPageRange().count;
  doc.outline.addItem(copy.chapterHeading(chapterNumber, chapter.title));
  renderChapterOpener(doc, copy.chapterNumber(chapterNumber), chapter.title, style);

  if (chapter.introduction) {
    renderChapterFraming(doc, copy.introduction, chapter.introduction, style);
  }
  renderChapterBody(doc, chapter, includeDates, language, style);
  if (chapter.summary) {
    doc.moveDown(0.8);
    renderChapterFraming(doc, copy.chapterSummary, chapter.summary, style);
  }

  return startPageNumber;
}

/** The "About this book" page that closes the book, a third of the way down, centred. */
function renderClosingPage(doc: PDFKit.PDFDocument, book: Book, style: BookInteriorStyle): void {
  doc.addPage();
  doc.addNamedDestination(BOOK_PDF_DESTINATIONS.about);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.font(style.fonts.bold).fontSize(style.chapterSize - 4).fillColor('#000000')
    .text(bookCopy(book.language).closingHeading, doc.page.margins.left, doc.page.height / 3, { width, align: 'center' });
  doc.moveDown(1);
  doc.font(style.fonts.regular).fontSize(style.bodySize).fillColor('#444444');
  for (const line of bookClosingPageLines(book)) {
    doc.text(line, { width, align: 'center', paragraphGap: 6 });
  }
  doc.fillColor('#000000');
}

/** Numbers every page from the second, as printed books count them, except the dedication and epigraph pages. */
function renderPageNumbers(doc: PDFKit.PDFDocument, unnumbered: ReadonlySet<number>, style: BookInteriorStyle): void {
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.start + range.count; i++) {
    if (unnumbered.has(i)) {
      continue;
    }
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(style.fonts.regular).fontSize(PAGE_NUMBER_FONT_SIZE).fillColor('#888888');
    doc.text(String(i + 1), 0, doc.page.height - FOOTER_OFFSET, {
      width: doc.page.width,
      align: 'center',
      lineBreak: false,
    });
    doc.page.margins.bottom = bottomMargin;
  }
}

/**
 * Render a book as a PDF document with a title page, its dedication and epigraph pages, table of
 * contents (with chapter page numbers), one section per chapter, its closing page, and centered
 * page numbers, in the type, margins, chapter openers and photo layout of its interior theme.
 */
export function renderBookPdf(book: Book, options: RenderBookOptions = {}): Promise<Buffer> {
  const includeDates = options.includeDates !== false;
  const includeToc = options.includeToc !== false;
  const style = bookInteriorStyle(book.interior);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: style.margin,
      bufferPages: true,
      lang: book.language ?? 'en',
      info: {
        Title: book.title,
        ...(book.author && { Author: book.author }),
        Creator: 'Thoughty',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderTitlePage(doc, book, style);
    const unnumbered = new Set<number>();
    if (book.dedication) {
      unnumbered.add(renderFrontPage(doc, 'dedication', book.dedication, style));
    }
    if (book.epigraph) {
      unnumbered.add(renderFrontPage(doc, 'epigraph', book.epigraph, style));
    }

    let tocPositions: TocLinePosition[] = [];
    if (includeToc && book.chapters.length > 0) {
      tocPositions = renderTableOfContents(doc, book, style);
    }

    const chapterPageNumbers: number[] = [];
    for (const [index, chapter] of book.chapters.entries()) {
      chapterPageNumbers.push(renderChapter(doc, chapter, index + 1, includeDates, book.language, style));
    }

    if (book.closingPage) {
      renderClosingPage(doc, book, style);
    }

    if (tocPositions.length > 0) {
      fillTocPageNumbers(doc, tocPositions, chapterPageNumbers, style);
    }
    renderPageNumbers(doc, unnumbered, style);

    doc.end();
  });
}

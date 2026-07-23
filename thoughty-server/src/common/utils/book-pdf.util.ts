import PDFDocument from 'pdfkit';
import {
  Book,
  RenderBookOptions,
  stripMarkdown,
} from './book-converter.util';
import { BOOK_COVER_PALETTES } from './book-cover-style.util';

const PAGE_MARGIN = 72;
const TITLE_FONT_SIZE = 28;
const CHAPTER_FONT_SIZE = 20;
const DATE_FONT_SIZE = 9;
const BODY_FONT_SIZE = 11;
const FOOTER_OFFSET = 40;
const TOC_LINE_GAP = 6;
const TOC_PAGE_NUM_WIDTH = 40;
const FRAMING_FONT_SIZE = 10;
const ENTRY_IMAGE_HEIGHT = 220;

interface TocLinePosition {
  pageIndex: number;
  y: number;
}

function renderTitlePage(doc: PDFKit.PDFDocument, book: Book): void {
  const palette = BOOK_COVER_PALETTES[book.cover?.theme ?? 'classic'];
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(palette.background);
  doc.rect(0, 0, doc.page.width, 12).fill(palette.accent);

  if (book.cover?.image) {
    doc.image(book.cover.image.data, PAGE_MARGIN, 72, {
      fit: [doc.page.width - PAGE_MARGIN * 2, 300],
      align: 'center',
      valign: 'center',
    });
    doc.y = 410;
  } else {
    doc.moveDown(8);
  }

  doc.fillColor(palette.foreground).font('Helvetica-Bold').fontSize(TITLE_FONT_SIZE).text(book.title, { align: 'center' });
  doc.moveDown(1);
  if (book.author) {
    doc.font('Helvetica-Oblique').fontSize(14).text(`by ${book.author}`, { align: 'center' });
    doc.moveDown(1);
  }
  doc.font('Helvetica').fontSize(11).fillColor(palette.accent).text(book.generatedAt, { align: 'center' });
  doc.fillColor('#000000');
}

/**
 * Render the table of contents and record where each chapter line was drawn,
 * so the chapter page numbers can be filled in after the chapters are rendered.
 */
function renderTableOfContents(doc: PDFKit.PDFDocument, book: Book): TocLinePosition[] {
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(CHAPTER_FONT_SIZE).text('Table of Contents');
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(BODY_FONT_SIZE);

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
): void {
  doc.font('Helvetica').fontSize(BODY_FONT_SIZE).fillColor('#000000');
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
): void {
  if (chapter.narrative) {
    doc.font('Helvetica').fontSize(BODY_FONT_SIZE).fillColor('#000000').text(chapter.narrative, {
      align: 'justify',
      lineGap: 2,
      paragraphGap: 8,
    });
    for (const entry of chapter.entries) {
      renderEntryImages(doc, entry);
    }
    return;
  }

  for (const entry of chapter.entries) {
    if (includeDates) {
      doc.font('Helvetica-Oblique').fontSize(DATE_FONT_SIZE).fillColor('#888888').text(entry.date);
      doc.moveDown(0.3);
    }
    const content = entry.format === 'markdown' ? stripMarkdown(entry.content) : entry.content;
    doc.font('Helvetica').fontSize(BODY_FONT_SIZE).fillColor('#000000').text(content, {
      align: 'justify',
      lineGap: 2,
    });
    doc.moveDown(1.2);
    renderEntryImages(doc, entry);
  }
}

function renderEntryImages(doc: PDFKit.PDFDocument, entry: Book['chapters'][number]['entries'][number]): void {
  for (const image of entry.images ?? []) {
    if (!image.data || (image.mimeType !== 'image/jpeg' && image.mimeType !== 'image/png')) {
      continue;
    }

    if (doc.y + ENTRY_IMAGE_HEIGHT > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
    const imageY = doc.y;
    try {
      doc.image(image.data, doc.page.margins.left, imageY, {
        fit: [
          doc.page.width - doc.page.margins.left - doc.page.margins.right,
          ENTRY_IMAGE_HEIGHT - 30,
        ],
        align: 'center',
        valign: 'center',
      });
    } catch {
      continue;
    }
    doc.y = imageY + ENTRY_IMAGE_HEIGHT - 22;
    doc.font('Helvetica-Oblique').fontSize(DATE_FONT_SIZE).fillColor('#666666').text(
      `${entry.date} - ${image.name}`,
      { align: 'center' },
    );
    doc.fillColor('#000000').moveDown(1);
  }
}

function renderChapterFraming(doc: PDFKit.PDFDocument, heading: string, content: string): void {
  doc.font('Helvetica-Bold').fontSize(BODY_FONT_SIZE).fillColor('#333333').text(heading);
  doc.moveDown(0.35);
  doc.font('Helvetica-Oblique').fontSize(FRAMING_FONT_SIZE).fillColor('#444444').text(content, {
    align: 'justify',
    lineGap: 2,
  });
  doc.fillColor('#000000').moveDown(1.2);
}

function renderChapter(
  doc: PDFKit.PDFDocument,
  chapter: Book['chapters'][number],
  chapterNumber: number,
  includeDates: boolean,
): number {
  doc.addPage();
  const startPageNumber = doc.bufferedPageRange().count;
  doc.outline.addItem(`Chapter ${chapterNumber}: ${chapter.title}`);
  doc.font('Helvetica-Bold').fontSize(CHAPTER_FONT_SIZE).text(`Chapter ${chapterNumber}`);
  doc.moveDown(0.2);
  doc.fontSize(CHAPTER_FONT_SIZE - 4).text(chapter.title);
  doc.moveDown(1.5);

  if (chapter.introduction) {
    renderChapterFraming(doc, 'Introduction', chapter.introduction);
  }
  renderChapterBody(doc, chapter, includeDates);
  if (chapter.summary) {
    doc.moveDown(0.8);
    renderChapterFraming(doc, 'Chapter Summary', chapter.summary);
  }

  return startPageNumber;
}

function renderPageNumbers(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  // Skip the title page; numbering starts on page 2
  for (let i = 1; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(9).fillColor('#888888');
    doc.text(String(i + 1), 0, doc.page.height - FOOTER_OFFSET, {
      width: doc.page.width,
      align: 'center',
      lineBreak: false,
    });
    doc.page.margins.bottom = bottomMargin;
  }
}

/**
 * Render a book as a PDF document with a title page, table of contents
 * (with chapter page numbers), one section per chapter, and centered page numbers.
 */
export function renderBookPdf(book: Book, options: RenderBookOptions = {}): Promise<Buffer> {
  const includeDates = options.includeDates !== false;
  const includeToc = options.includeToc !== false;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      bufferPages: true,
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

    renderTitlePage(doc, book);

    let tocPositions: TocLinePosition[] = [];
    if (includeToc && book.chapters.length > 0) {
      tocPositions = renderTableOfContents(doc, book);
    }

    const chapterPageNumbers: number[] = [];
    for (const [index, chapter] of book.chapters.entries()) {
      chapterPageNumbers.push(renderChapter(doc, chapter, index + 1, includeDates));
    }

    if (tocPositions.length > 0) {
      fillTocPageNumbers(doc, tocPositions, chapterPageNumbers);
    }
    renderPageNumbers(doc);

    doc.end();
  });
}

/** A chapter of the mock book: its title and the text of each entry. */
export interface MockPdfChapter {
  title: string;
  paragraphs: string[];
}

interface MockPdfBook {
  title: string;
  author: string;
  includeToc: boolean;
  chapters: MockPdfChapter[];
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 72;
const LINE_HEIGHT = 16;
const WRAP_COLUMNS = 80;
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - MARGIN * 2 - 60) / LINE_HEIGHT);

/** PDF string literal text: Latin-1 only, with its delimiters escaped. */
function pdfText(text: string): string {
  return text
    .replaceAll(/[^\x20-\x7e\xa0-\xff]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrap(text: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + word.length + 1 > WRAP_COLUMNS) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface MockPage {
  lines: Array<{ text: string; size: number }>;
}

/** The pages of one chapter: its heading, then its entries, continued on new pages as the server's PDF does. */
function chapterPages(chapter: MockPdfChapter, number: number): MockPage[] {
  const lines = [
    { text: `Chapter ${number}`, size: 20 },
    { text: chapter.title, size: 16 },
    ...chapter.paragraphs.flatMap((paragraph) => [...wrap(paragraph).map((text) => ({ text, size: 11 })), { text: "", size: 11 }]),
  ];
  const pages: MockPage[] = [];
  for (let start = 0; start < lines.length; start += LINES_PER_PAGE) {
    pages.push({ lines: lines.slice(start, start + LINES_PER_PAGE) });
  }
  return pages;
}

function contentStream(page: MockPage, pageNumber: number): string {
  const commands = ["BT", `${MARGIN} ${PAGE_HEIGHT - MARGIN} Td`];
  for (const line of page.lines) {
    commands.push(`/F1 ${line.size} Tf`, `0 -${Math.max(line.size + 4, LINE_HEIGHT)} Td`, `(${pdfText(line.text)}) Tj`);
  }
  commands.push("ET");
  if (pageNumber > 1) {
    commands.push("BT", "/F1 9 Tf", `${PAGE_WIDTH / 2 - 4} 40 Td`, `(${pageNumber}) Tj`, "ET");
  }
  return commands.join("\n");
}

/**
 * A real, multi-page PDF laid out like the server's book: a title page, a table of contents with
 * chapter page numbers, each chapter starting on a new page, page numbers from page 2, and one
 * outline item per chapter ("Chapter N: title") pointing at its first page.
 */
export function buildMockBookPdf(book: MockPdfBook): Buffer {
  const pages: MockPage[] = [{ lines: [{ text: book.title, size: 28 }, { text: `by ${book.author}`, size: 14 }] }];
  const tocIndex = book.includeToc && book.chapters.length > 0 ? pages.push({ lines: [] }) - 1 : -1;
  const chapterStarts: number[] = [];
  book.chapters.forEach((chapter, index) => {
    chapterStarts.push(pages.length + 1);
    pages.push(...chapterPages(chapter, index + 1));
  });
  if (tocIndex >= 0) {
    pages[tocIndex] = {
      lines: [
        { text: "Table of Contents", size: 20 },
        ...book.chapters.map((chapter, index) => ({ text: `${index + 1}. ${chapter.title} .... ${chapterStarts[index]}`, size: 11 })),
      ],
    };
  }

  // Objects: 1 catalog, 2 pages, 3 font, 4 outline root, then each page and its content, then outline items
  const objects: string[] = [];
  const pageObject = (index: number) => 5 + index * 2;
  const outlineObject = (index: number) => 5 + pages.length * 2 + index;
  const count = book.chapters.length;
  objects[1] = `<< /Type /Catalog /Pages 2 0 R${count ? " /Outlines 4 0 R /PageMode /UseOutlines" : ""} >>`;
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageObject(index)} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = count
    ? `<< /Type /Outlines /First ${outlineObject(0)} 0 R /Last ${outlineObject(count - 1)} 0 R /Count ${count} >>`
    : "<< /Type /Outlines /Count 0 >>";
  pages.forEach((page, index) => {
    const stream = contentStream(page, index + 1);
    objects[pageObject(index)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageObject(index) + 1} 0 R >>`;
    objects[pageObject(index) + 1] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });
  book.chapters.forEach((chapter, index) => {
    const links = [
      index > 0 ? `/Prev ${outlineObject(index - 1)} 0 R` : "",
      index < count - 1 ? `/Next ${outlineObject(index + 1)} 0 R` : "",
    ].filter(Boolean).join(" ");
    objects[outlineObject(index)] =
      `<< /Title (${pdfText(`Chapter ${index + 1}: ${chapter.title}`)}) /Parent 4 0 R ${links} /Dest [${pageObject(chapterStarts[index]! - 1)} 0 R /XYZ null null null] >>`;
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let number = 1; number < objects.length; number += 1) {
    offsets[number] = Buffer.byteLength(body, "latin1");
    body += `${number} 0 obj\n${objects[number]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let number = 1; number < objects.length; number += 1) {
    body += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

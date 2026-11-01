/** The longest dedication a book takes, in characters: a few lines on its own page. */
export const MAX_BOOK_DEDICATION_LENGTH = 300;
/** The longest epigraph a book takes, in characters: a short quotation and who said it. */
export const MAX_BOOK_EPIGRAPH_LENGTH = 500;

/**
 * A dedication or epigraph as a book prints it: Windows line breaks made plain, spaces at the ends of
 * lines dropped, at most one blank line between paragraphs, and nothing around it. Undefined when
 * nothing is left.
 */
export function normalizeBookPageText(text: string | undefined): string | undefined {
  const normalized = (text ?? '')
    .replaceAll(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || undefined;
}

/** Text Markdown shows as written: every ASCII punctuation mark escaped, so none starts markup or HTML. */
export function escapeBookMarkdownText(text: string): string {
  return text.replaceAll(/[!-/:-@[-`{-~]/g, String.raw`\$&`);
}

/**
 * A dedication or epigraph as Markdown lines: each line escaped and in italics, its line breaks kept as
 * hard breaks and its blank lines as paragraph breaks.
 */
export function bookPageMarkdownLines(text: string): string[] {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    if (!line.trim()) {
      return '';
    }
    const hardBreak = lines[index + 1]?.trim() ? '\\' : '';
    return `*${escapeBookMarkdownText(line.trim())}*${hardBreak}`;
  });
}

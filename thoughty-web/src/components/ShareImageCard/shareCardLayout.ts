/**
 * Pure layout helpers for the share-as-image card: the presets, the plain text that goes on the
 * card, and the line wrapping that fits it into the card with an ellipsis when it is too long.
 * Nothing here touches the DOM, so the drawing code and the tests share one measure function.
 */

export type CardThemeId = 'light' | 'dark' | 'violet';
export type CardSizeId = 'square' | 'portrait';

export interface CardTheme {
  /** Background gradient stops, top-left to bottom-right. */
  readonly background: readonly string[];
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
}

/** The app's palette: the light and dark surfaces, and the logo's blue-to-violet gradient. */
export const CARD_THEMES: Readonly<Record<CardThemeId, CardTheme>> = {
  light: { background: ['#FFFFFF', '#F3F4F6'], text: '#111827', muted: '#4B5563', accent: '#7C3AED' },
  dark: { background: ['#1F2937', '#111827'], text: '#F3F4F6', muted: '#9CA3AF', accent: '#A78BFA' },
  violet: { background: ['#3B82F6', '#7C3AED', '#9333EA'], text: '#FFFFFF', muted: '#E9D5FF', accent: '#FBCFE8' },
};

export const CARD_THEME_IDS: readonly CardThemeId[] = ['light', 'dark', 'violet'];
export const CARD_SIZE_IDS: readonly CardSizeId[] = ['square', 'portrait'];

/** Logical card sizes; the exported PNG is drawn at `CARD_SCALE` times these (1080 px wide). */
export const CARD_SIZES: Readonly<Record<CardSizeId, { width: number; height: number }>> = {
  square: { width: 540, height: 540 },
  portrait: { width: 540, height: 675 },
};

/** Pixel density of the exported image, so it stays sharp on high-DPI screens and feeds. */
export const CARD_SCALE = 2;

/** The longest text the card accepts; anything longer would not fit even at the smallest size. */
export const CARD_TEXT_MAX_LENGTH = 1500;

export const ELLIPSIS = '…';

export type MeasureText = (text: string) => number;

export interface WrappedText {
  readonly lines: string[];
  readonly truncated: boolean;
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Splits text into user-perceived characters, so an emoji sequence or accented letter is never cut. */
export function splitGraphemes(text: string): string[] {
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/**
 * Turns an entry's text into what the card shows: Markdown syntax, entry links and task boxes are
 * dropped, spaces collapse, and paragraphs stay apart on their own lines.
 */
export function toCardText(content: string, format: 'plain' | 'markdown' = 'plain'): string {
  let text = content.replaceAll('\r\n', '\n');
  if (format === 'markdown') {
    text = text
      .replaceAll(/```[^\n]*\n?/g, '')
      .replaceAll(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replaceAll(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/gm, '')
      .replaceAll(/^\s*(?:[-*_]\s*){3,}$/gm, '')
      .replaceAll(/(\*\*|__|~~)(.+?)\1/g, '$2')
      .replaceAll(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
      .replaceAll(/`([^`]+)`/g, '$1');
  }
  text = text.replaceAll(/\[\[([^\]]+)\]\]/g, '$1');
  return text
    .split(/\n\s*\n|\n/)
    .map((line) => line.replaceAll(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const collapseSpaces = (text: string) => text.replaceAll(/\s+/g, ' ').trim();

/**
 * The text the person selected, when it is part of this entry's card text: the card then starts
 * from that excerpt. A selection elsewhere on the page is ignored.
 */
export function selectedExcerpt(selection: string | undefined, cardText: string): string | undefined {
  const excerpt = collapseSpaces(selection ?? '');
  if (!excerpt) return undefined;
  return collapseSpaces(cardText).includes(excerpt) ? excerpt : undefined;
}

const withEllipsis = (text: string) => `${text.replace(/[\s,;:.\-–—]+$/u, '')}${ELLIPSIS}`;

/**
 * Ends a line with an ellipsis that still fits: whole words are dropped first, then characters
 * of the last word, and dangling spaces and commas never sit before the ellipsis.
 */
export function ellipsize(line: string, maxWidth: number, measure: MeasureText): string {
  const words = line.split(' ');
  while (words.length > 1) {
    const candidate = withEllipsis(words.join(' '));
    if (measure(candidate) <= maxWidth) return candidate;
    words.pop();
  }
  const graphemes = splitGraphemes(words[0] ?? '');
  while (graphemes.length > 0) {
    const candidate = withEllipsis(graphemes.join(''));
    if (measure(candidate) <= maxWidth) return candidate;
    graphemes.pop();
  }
  return ELLIPSIS;
}

/** Breaks a word wider than the line into pieces that each fit, character by character. */
function breakLongWord(word: string, maxWidth: number, measure: MeasureText): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const grapheme of splitGraphemes(word)) {
    if (piece && measure(piece + grapheme) > maxWidth) {
      pieces.push(piece);
      piece = grapheme;
    } else {
      piece += grapheme;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/**
 * Wraps text into lines no wider than `maxWidth`, keeping its line breaks. Past `maxLines` it stops
 * and ends the last line with an ellipsis.
 */
export function wrapText(text: string, maxWidth: number, maxLines: number, measure: MeasureText): WrappedText {
  const limit = Math.max(1, Math.floor(maxLines));
  const lines: string[] = [];
  let overflow = false;

  const push = (line: string) => {
    if (lines.length >= limit) {
      overflow = true;
      return;
    }
    lines.push(line);
  };

  for (const paragraph of text.split('\n')) {
    if (overflow) break;
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (overflow) break;
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) push(line);
      const pieces = measure(word) <= maxWidth ? [word] : breakLongWord(word, maxWidth, measure);
      pieces.slice(0, -1).forEach(push);
      line = pieces.at(-1) ?? '';
    }
    if (line) push(line);
  }

  if (!overflow) return { lines, truncated: false };
  const last = lines.length - 1;
  lines[last] = ellipsize(lines[last] ?? '', maxWidth, measure);
  return { lines, truncated: true };
}

export interface FittedText extends WrappedText {
  readonly fontSize: number;
  readonly lineHeight: number;
}

interface FitOptions {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly maxFontSize: number;
  readonly minFontSize: number;
  readonly lineHeightRatio: number;
  /** Returns a measure function for text drawn at the given font size. */
  readonly measureAt: (fontSize: number) => MeasureText;
}

/**
 * Picks the largest font size at which the whole text fits the box; when even the smallest size
 * is too big, the text is cut with an ellipsis at that size.
 */
export function fitText(text: string, options: FitOptions): FittedText {
  const { maxWidth, maxHeight, maxFontSize, minFontSize, lineHeightRatio, measureAt } = options;
  let fitted: FittedText | null = null;
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * lineHeightRatio);
    const wrapped = wrapText(text, maxWidth, Math.floor(maxHeight / lineHeight), measureAt(fontSize));
    fitted = { ...wrapped, fontSize, lineHeight };
    if (!wrapped.truncated) return fitted;
  }
  return fitted ?? { lines: [], truncated: false, fontSize: minFontSize, lineHeight: Math.round(minFontSize * lineHeightRatio) };
}

/** The entry's day written out in the reader's language, e.g. "27 octobre 2026". */
export function formatCardDate(date: string, language: string): string {
  const day = date.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return day;
  return new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
}

/** The downloaded file's name, e.g. `thoughty-2026-10-27.png`. */
export function cardFilename(date: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(date)?.[0];
  return day ? `thoughty-${day}.png` : 'thoughty-card.png';
}

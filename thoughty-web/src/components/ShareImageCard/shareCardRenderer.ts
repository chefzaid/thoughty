import {
  CARD_SCALE,
  CARD_SIZES,
  CARD_THEMES,
  fitText,
  wrapText,
  type CardSizeId,
  type CardThemeId,
  type FittedText,
} from './shareCardLayout';

/** Tailwind's sans stack, with the emoji fonts so emoji draw in color; no web font is downloaded. */
const FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

const PADDING = 48;
const QUOTE_MARK_SIZE = 72;
const TITLE_SIZE = 22;
const FOOTER_SIZE = 16;
const LOGO_SIZE = 28;
const GAP = 20;

export interface ShareCardContent {
  readonly text: string;
  readonly title?: string;
  readonly date: string;
  readonly theme: CardThemeId;
  readonly size: CardSizeId;
  readonly showMark: boolean;
  /** "Thoughty", the mark written next to the logo. */
  readonly markLabel: string;
}

export interface ShareCardLayout {
  readonly title: string[];
  readonly quote: FittedText;
}

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT_STACK}`;
const titleLineHeight = Math.round(TITLE_SIZE * 1.3);
/** Where the title and quote may start: below the quotation mark. */
const CONTENT_TOP = PADDING + QUOTE_MARK_SIZE * 0.6 + GAP;
const contentBottom = (height: number) => height - PADDING - LOGO_SIZE - GAP;

function titleHeight(title: readonly string[]): number {
  return title.length > 0 ? title.length * titleLineHeight + GAP : 0;
}

function measureWith(ctx: CanvasRenderingContext2D, fontSpec: string) {
  return (text: string) => {
    ctx.font = fontSpec;
    return ctx.measureText(text).width;
  };
}

/** Works out the title and quote lines for the card, in logical (unscaled) units. */
export function layoutShareCard(ctx: CanvasRenderingContext2D, content: ShareCardContent): ShareCardLayout {
  const { width, height } = CARD_SIZES[content.size];
  const innerWidth = width - PADDING * 2;
  const title = content.title?.trim()
    ? wrapText(content.title.trim(), innerWidth, 2, measureWith(ctx, font(700, TITLE_SIZE))).lines
    : [];
  const quote = fitText(content.text, {
    maxWidth: innerWidth,
    maxHeight: contentBottom(height) - CONTENT_TOP - titleHeight(title),
    maxFontSize: 36,
    minFontSize: 18,
    lineHeightRatio: 1.4,
    measureAt: (fontSize) => measureWith(ctx, font(500, fontSize)),
  });
  return { title, quote };
}

function paintBackground(ctx: CanvasRenderingContext2D, stops: readonly string[], width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  stops.forEach((color, index) => gradient.addColorStop(stops.length === 1 ? 0 : index / (stops.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draws the card: a quotation mark, the optional title, the quote, then the date and the
 * "Thoughty" mark along the bottom. The canvas is resized to the card at `CARD_SCALE`.
 */
export function drawShareCard(
  canvas: HTMLCanvasElement,
  content: ShareCardContent,
  logo: CanvasImageSource | null,
): ShareCardLayout | null {
  const { width, height } = CARD_SIZES[content.size];
  canvas.width = width * CARD_SCALE;
  canvas.height = height * CARD_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const theme = CARD_THEMES[content.theme];
  ctx.setTransform(CARD_SCALE, 0, 0, CARD_SCALE, 0, 0);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  paintBackground(ctx, theme.background, width, height);

  ctx.fillStyle = theme.accent;
  ctx.font = `700 ${QUOTE_MARK_SIZE}px Georgia, "Times New Roman", serif`;
  ctx.fillText('\u201C', PADDING - 4, PADDING - QUOTE_MARK_SIZE * 0.2);

  const layout = layoutShareCard(ctx, content);
  const { quote } = layout;
  // A short quote sits in the middle of the free space rather than right under the quotation mark.
  const blockHeight = titleHeight(layout.title) + quote.lines.length * quote.lineHeight;
  let y = CONTENT_TOP + Math.max(0, (contentBottom(height) - CONTENT_TOP - blockHeight) / 2);

  ctx.fillStyle = theme.text;
  ctx.font = font(700, TITLE_SIZE);
  for (const line of layout.title) {
    ctx.fillText(line, PADDING, y);
    y += titleLineHeight;
  }
  if (layout.title.length > 0) y += GAP;

  ctx.font = font(500, quote.fontSize);
  for (const line of quote.lines) {
    ctx.fillText(line, PADDING, y + (quote.lineHeight - quote.fontSize) / 2);
    y += quote.lineHeight;
  }

  const footerY = height - PADDING - LOGO_SIZE;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.muted;
  ctx.font = font(500, FOOTER_SIZE);
  ctx.fillText(content.date, PADDING, footerY + LOGO_SIZE / 2);

  if (content.showMark) {
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.text;
    ctx.font = font(700, FOOTER_SIZE + 2);
    const middle = footerY + LOGO_SIZE / 2;
    let right = width - PADDING;
    ctx.fillText(content.markLabel, right, middle);
    right -= ctx.measureText(content.markLabel).width + 8;
    if (logo) {
      ctx.drawImage(logo, right - LOGO_SIZE, footerY, LOGO_SIZE, LOGO_SIZE);
      right -= LOGO_SIZE + 8;
    }
    ctx.fillText('—', right, middle);
  }
  return layout;
}

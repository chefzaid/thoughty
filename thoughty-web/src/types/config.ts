// Configuration and settings types
import type { CSSProperties } from 'react';

export interface Config {
  entriesPerPage?: string | number;
  maxPinnedEntries?: string | number;
  language?: string;
  theme?: 'light' | 'dark';
  fontFamily?: FontFamilyPreference;
  fontSize?: string | number;
  fontColor?: string;
  /** Line spacing of entry text; `normal` keeps each view's own. */
  lineSpacing?: LineSpacingPreference;
  /** Letter spacing of entry text; `normal` keeps the font's own. */
  letterSpacing?: LetterSpacingPreference;
  highContrast?: boolean | string;
  ttsVoiceUri?: string;
  name?: string;
  bio?: string;
  email?: string;
  birthday?: string;
  gender?: string;
  avatarUrl?: string;
  defaultVisibility?: 'public' | 'private';
  readDates?: boolean;
  /** The journal's writing streak card; shown unless false. */
  streakCard?: boolean;
  /** Quiet mode hides streaks, badges, karma, likes, counts and goal progress; off unless true. */
  quietMode?: boolean;
  /** After a very low mood, offer favorite or gratitude entries to reread; offered unless false. */
  comfortReads?: boolean;
  openRouterModel?: string;
  openRouterSummaryModel?: string;
  openRouterPromptModel?: string;
  autoTagMaxTags?: string | number;
  tagMetadata?: string;
  entryTemplates?: string;
  /** Prompt card ids drawn since their deck was last used up, comma-separated. */
  promptCardsDrawn?: string;
  subscriptionPlan?: 'free' | 'plus' | 'pro';
  paymentMethodLabel?: string;
}

export type Theme = 'light' | 'dark';
export type Visibility = 'public' | 'private';
export type VisibilityFilter = 'all' | 'public' | 'private';
export type ArchiveStatusFilter = 'all' | 'active' | 'archived';

export type FontFamilyPreference = 'system' | 'serif' | 'modern' | 'mono' | 'legible';
export type LineSpacingPreference = 'normal' | 'relaxed' | 'loose';
export type LetterSpacingPreference = 'normal' | 'wide' | 'wider';

export const DEFAULT_FONT_FAMILY: FontFamilyPreference = 'system';
export const DEFAULT_FONT_SIZE = 16;
export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 22;

const FONT_FAMILY_MAP: Record<FontFamilyPreference, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  modern: '"Trebuchet MS", "Segoe UI", sans-serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  // Self-hosted (see main.tsx), so the CSP's font-src 'self' still covers it
  legible: '"Atkinson Hyperlegible", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export const normalizeFontSize = (fontSize?: string | number): number => {
  const parsedSize = typeof fontSize === 'number' ? fontSize : Number(fontSize);

  if (!Number.isFinite(parsedSize)) {
    return DEFAULT_FONT_SIZE;
  }

  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsedSize));
};

export const resolveFontFamily = (fontFamily?: FontFamilyPreference): string => {
  return FONT_FAMILY_MAP[fontFamily ?? DEFAULT_FONT_FAMILY];
};

export const resolveFontColor = (fontColor?: string, theme: Theme = 'dark'): string => {
  if (fontColor && /^#[0-9a-fA-F]{6}$/.test(fontColor)) {
    return fontColor;
  }

  return theme === 'light' ? '#111827' : '#f3f4f6';
};

/**
 * The line height and letter spacing of each step. `normal` sets nothing, so every view keeps the
 * spacing it has always had; `wider` is the letter spacing WCAG 1.4.12 (text spacing) asks text to bear.
 */
const LINE_HEIGHTS: Record<LineSpacingPreference, number | undefined> = {
  normal: undefined,
  relaxed: 1.9,
  loose: 2.2,
};

const LETTER_SPACINGS: Record<LetterSpacingPreference, string | undefined> = {
  normal: undefined,
  wide: '0.06em',
  wider: '0.12em',
};

export const DEFAULT_LINE_SPACING: LineSpacingPreference = 'normal';
export const DEFAULT_LETTER_SPACING: LetterSpacingPreference = 'normal';
export const LINE_SPACING_OPTIONS = Object.keys(LINE_HEIGHTS) as LineSpacingPreference[];
export const LETTER_SPACING_OPTIONS = Object.keys(LETTER_SPACINGS) as LetterSpacingPreference[];

export const resolveLineHeight = (lineSpacing?: LineSpacingPreference): number | undefined =>
  lineSpacing && Object.hasOwn(LINE_HEIGHTS, lineSpacing) ? LINE_HEIGHTS[lineSpacing] : undefined;

export const resolveLetterSpacing = (letterSpacing?: LetterSpacingPreference): string | undefined =>
  letterSpacing && Object.hasOwn(LETTER_SPACINGS, letterSpacing) ? LETTER_SPACINGS[letterSpacing] : undefined;

/** The writer's spacing preferences, as entry text uses them. */
export type EntrySpacing = Pick<Config, 'lineSpacing' | 'letterSpacing'>;

/** The line height and letter spacing entry text takes, as an inline style; empty for `normal`. */
export const entrySpacingStyle = ({ lineSpacing, letterSpacing }: EntrySpacing): CSSProperties => ({
  lineHeight: resolveLineHeight(lineSpacing),
  letterSpacing: resolveLetterSpacing(letterSpacing),
});

/**
 * The same spacing as CSS custom properties (`--entry-line-height`, `--entry-letter-spacing`), for
 * text whose own stylesheet sets its spacing, such as the Markdown editor; empty for `normal`.
 */
export const entrySpacingVariables = (spacing: EntrySpacing): CSSProperties => {
  const { lineHeight, letterSpacing } = entrySpacingStyle(spacing);
  return {
    ...(lineHeight === undefined ? {} : { '--entry-line-height': String(lineHeight) }),
    ...(letterSpacing === undefined ? {} : { '--entry-letter-spacing': letterSpacing }),
  } as CSSProperties;
};

/**
 * The style of entry text as it is read or written: the writer's text color and spacing.
 * Titles keep their own tighter line height and take only the color and letter spacing.
 */
export const entryTextStyle = (
  preferences: EntrySpacing & Pick<Config, 'fontColor'>,
  theme: Theme = 'dark',
  { title = false }: { title?: boolean } = {},
): CSSProperties => {
  const spacing = entrySpacingStyle(preferences);
  return {
    color: resolveFontColor(preferences.fontColor, theme),
    letterSpacing: spacing.letterSpacing,
    ...(title ? {} : { lineHeight: spacing.lineHeight }),
  };
};

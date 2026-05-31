// Configuration and settings types

export interface Config {
  entriesPerPage?: string | number;
  language?: string;
  theme?: 'light' | 'dark';
  fontFamily?: FontFamilyPreference;
  fontSize?: string | number;
  fontColor?: string;
  name?: string;
  bio?: string;
  email?: string;
  birthday?: string;
  gender?: string;
  avatarUrl?: string;
  defaultVisibility?: 'public' | 'private';
  readDates?: boolean;
  openRouterModel?: string;
  autoTagMaxTags?: string | number;
  tagMetadata?: string;
}

export interface AppConfig {
  enableGoogleAuth: boolean;
  enableEmailVerification: boolean;
  maxEntriesPerPage: number;
  maxTagsPerEntry: number;
  maxContentLength: number;
  supportedLanguages: string[];
  defaultLanguage: string;
  defaultTheme: 'light' | 'dark';
}

export type Theme = 'light' | 'dark';
export type Visibility = 'public' | 'private';
export type VisibilityFilter = 'all' | 'public' | 'private';
export type ArchiveStatusFilter = 'all' | 'active' | 'archived';

export type FontFamilyPreference = 'system' | 'serif' | 'modern' | 'mono';

export const DEFAULT_FONT_FAMILY: FontFamilyPreference = 'system';
export const DEFAULT_FONT_SIZE = 16;
export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 22;

const FONT_FAMILY_MAP: Record<FontFamilyPreference, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  modern: '"Trebuchet MS", "Segoe UI", sans-serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
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

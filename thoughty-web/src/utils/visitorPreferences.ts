import type { Language } from './translations';

export type Theme = 'light' | 'dark';

const LANGUAGE_STORAGE_KEY = 'thoughty.visitorLanguage';
const THEME_STORAGE_KEY = 'thoughty.visitorTheme';
const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';

/**
 * The browser's preferred interface language: the first of its languages that is English or French,
 * English when it lists neither.
 */
export function browserLanguage(
  languages: readonly string[] = globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? ''],
): Language {
  const supported = languages.find((language) => /^(en|fr)\b/i.test(language));
  return supported?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/** The system theme: light when the system asks for it, otherwise dark like the rest of Thoughty. */
export function systemTheme(): Theme {
  return globalThis.matchMedia?.(LIGHT_SCHEME_QUERY).matches ? 'light' : 'dark';
}

/** Calls `onChange` when the system switches between light and dark; returns the cleanup. */
export function watchSystemTheme(onChange: (theme: Theme) => void): () => void {
  const query = globalThis.matchMedia?.(LIGHT_SCHEME_QUERY);
  if (!query) return () => undefined;
  const listener = (event: MediaQueryListEvent) => onChange(event.matches ? 'light' : 'dark');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function readStored(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Remembering the choice is a convenience; it still applies for this visit.
  }
}

/** The language a visitor picked with the switch on the public pages, or null when they never did. */
export function storedVisitorLanguage(): Language | null {
  const stored = readStored(LANGUAGE_STORAGE_KEY);
  return stored === 'en' || stored === 'fr' ? stored : null;
}

/** The theme a visitor picked with the switch on the public pages, or null when they never did. */
export function storedVisitorTheme(): Theme | null {
  const stored = readStored(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

export function rememberVisitorLanguage(language: Language): void {
  writeStored(LANGUAGE_STORAGE_KEY, language);
}

export function rememberVisitorTheme(theme: Theme): void {
  writeStored(THEME_STORAGE_KEY, theme);
}

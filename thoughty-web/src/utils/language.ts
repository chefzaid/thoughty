import type { Language } from './translations';

/** The UI languages are English and French; anything else falls back to English. */
export function resolveLanguage(language: string | undefined): Language {
  return language === 'fr' ? 'fr' : 'en';
}

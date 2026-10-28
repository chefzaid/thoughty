import { useEffect } from 'react';
import type { Language } from '../../utils/translations';

/** Head tags a private share link's page adds while it shows, on top of the headers the server sends. */
const PAGE_META: ReadonlyArray<{ name: string; content: string }> = [
  { name: 'robots', content: 'noindex, nofollow, noarchive' },
  { name: 'referrer', content: 'no-referrer' },
];

/** The reader's language, from their browser: French or English. */
export function readerLanguage(languages: readonly string[] = globalThis.navigator?.languages ?? []): Language {
  return languages.find((language) => /^(en|fr)\b/i.test(language))?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/** The reader's theme, from their system setting; dark like the rest of Thoughty unless they ask for light. */
export function readerTheme(): 'light' | 'dark' {
  return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Keeps the shared page out of search engines and keeps its address (which holds the link's secret)
 * from being sent on as a referrer, sets the document's language and title, and the theme of the body.
 */
export function useSharedPageDocument(title: string, language: Language, theme: 'light' | 'dark'): void {
  useEffect(() => {
    const added = PAGE_META.map(({ name, content }) => {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.prepend(meta);
      return meta;
    });
    return () => added.forEach((meta) => meta.remove());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    document.body.classList.toggle('light-mode', theme === 'light');
    document.body.classList.toggle('dark-mode', theme !== 'light');
  }, [theme]);
}

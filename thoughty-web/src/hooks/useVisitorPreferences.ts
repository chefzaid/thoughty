import { useCallback, useEffect, useState } from 'react';

import type { Language } from '../utils/translations';
import {
  browserLanguage,
  rememberVisitorLanguage,
  rememberVisitorTheme,
  storedVisitorLanguage,
  storedVisitorTheme,
  systemTheme,
  watchSystemTheme,
  type Theme,
} from '../utils/visitorPreferences';

export interface VisitorPreferences {
  /** The language of the pages without one in their path: the last localized page read, or else `preferredLanguage`. */
  readonly language: Language;
  /** The language picked with the switch, or else the browser's: where the English public pages send a visitor. */
  readonly preferredLanguage: Language;
  readonly theme: Theme;
  readonly chooseLanguage: (language: Language) => void;
  readonly chooseTheme: (theme: Theme) => void;
}

/**
 * How the pages look for a visitor without a session: the browser's language and the system theme,
 * unless the visitor picked another with the switch on the public pages, remembered on this browser.
 * A localized public page is read in its path's language (`/fr/…` in French) whatever the browser says,
 * and so are the pages after it that have no language in their path, such as sign-in, until the visitor
 * picks one: `pageLanguage` is the language of the localized public page shown, if any.
 */
export function useVisitorPreferences(pageLanguage: Language | null = null): VisitorPreferences {
  const [chosenLanguage, setChosenLanguage] = useState(storedVisitorLanguage);
  const [readLanguage, setReadLanguage] = useState<Language | null>(null);
  const [chosenTheme, setChosenTheme] = useState(storedVisitorTheme);
  const [browser, setBrowser] = useState(() => browserLanguage());
  const [system, setSystem] = useState(systemTheme);

  useEffect(() => watchSystemTheme(setSystem), []);

  useEffect(() => {
    const onLanguageChange = () => setBrowser(browserLanguage());
    globalThis.addEventListener('languagechange', onLanguageChange);
    return () => globalThis.removeEventListener('languagechange', onLanguageChange);
  }, []);

  // Followed while rendering, so the page after it already reads in its language
  if (pageLanguage !== null && pageLanguage !== readLanguage) {
    setReadLanguage(pageLanguage);
  }

  const chooseLanguage = useCallback((language: Language) => {
    rememberVisitorLanguage(language);
    setChosenLanguage(language);
    setReadLanguage(null);
  }, []);

  const chooseTheme = useCallback((theme: Theme) => {
    rememberVisitorTheme(theme);
    setChosenTheme(theme);
  }, []);

  const preferredLanguage = chosenLanguage ?? browser;
  return {
    language: readLanguage ?? preferredLanguage,
    preferredLanguage,
    theme: chosenTheme ?? system,
    chooseLanguage,
    chooseTheme,
  };
}

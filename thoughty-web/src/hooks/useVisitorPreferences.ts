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
  readonly language: Language;
  readonly theme: Theme;
  readonly chooseLanguage: (language: Language) => void;
  readonly chooseTheme: (theme: Theme) => void;
}

/**
 * How the pages look for a visitor without a session: the browser's language and the system theme,
 * unless the visitor picked another with the switch on the public pages, remembered on this browser.
 */
export function useVisitorPreferences(): VisitorPreferences {
  const [chosenLanguage, setChosenLanguage] = useState(storedVisitorLanguage);
  const [chosenTheme, setChosenTheme] = useState(storedVisitorTheme);
  const [browser, setBrowser] = useState(() => browserLanguage());
  const [system, setSystem] = useState(systemTheme);

  useEffect(() => watchSystemTheme(setSystem), []);

  useEffect(() => {
    const onLanguageChange = () => setBrowser(browserLanguage());
    globalThis.addEventListener('languagechange', onLanguageChange);
    return () => globalThis.removeEventListener('languagechange', onLanguageChange);
  }, []);

  const chooseLanguage = useCallback((language: Language) => {
    rememberVisitorLanguage(language);
    setChosenLanguage(language);
  }, []);

  const chooseTheme = useCallback((theme: Theme) => {
    rememberVisitorTheme(theme);
    setChosenTheme(theme);
  }, []);

  return {
    language: chosenLanguage ?? browser,
    theme: chosenTheme ?? system,
    chooseLanguage,
    chooseTheme,
  };
}

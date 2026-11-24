import { createContext, useContext } from 'react';

import type { Language } from '../utils/translations';

/**
 * The language the pages are read in (a writer's settings, a visitor's choice or browser, or the path of a
 * localized public page), for the links to the localized public pages: they lead to the same language.
 */
export const DisplayLanguageContext = createContext<Language>('en');

export function useDisplayLanguage(): Language {
  return useContext(DisplayLanguageContext);
}

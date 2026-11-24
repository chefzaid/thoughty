import type { Language } from './translations';

/** The language and theme switch a visitor without a session finds on the public pages. */
export type VisitorPreferencesTranslationKey =
  | "visitorPreferencesLabel"
  | "visitorThemeUseLight"
  | "visitorThemeUseDark";

export const visitorPreferencesTranslations: Record<Language, Record<VisitorPreferencesTranslationKey, string>> = {
  en: {
    visitorPreferencesLabel: "Language and theme",
    visitorThemeUseLight: "Use the light theme",
    visitorThemeUseDark: "Use the dark theme",
  },
  fr: {
    visitorPreferencesLabel: "Langue et thème",
    visitorThemeUseLight: "Utiliser le thème clair",
    visitorThemeUseDark: "Utiliser le thème sombre",
  },
};

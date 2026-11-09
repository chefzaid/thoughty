import type { Language } from './translations';

/** The main navigation's groups and the items only it names. */
export type NavigationTranslationKey =
  | 'navGroupJournaling'
  | 'navGroupSocial'
  | 'navGroupInsights'
  | 'navGroupData'
  | 'navYearInReview';

export const navigationTranslations: Record<Language, Record<NavigationTranslationKey, string>> = {
  en: {
    navGroupJournaling: 'Journaling',
    navGroupSocial: 'Social',
    navGroupInsights: 'Insights',
    navGroupData: 'Data',
    navYearInReview: 'Year in review',
  },
  fr: {
    navGroupJournaling: 'Écriture',
    navGroupSocial: 'Social',
    navGroupInsights: 'Analyses',
    navGroupData: 'Données',
    navYearInReview: 'Bilan de l’année',
  },
};

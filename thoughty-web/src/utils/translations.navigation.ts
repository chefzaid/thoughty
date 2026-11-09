import type { Language } from './translations';

/** The main navigation's groups and the items only it names. */
export type NavigationTranslationKey =
  | 'navGroupJournaling'
  | 'navGroupSocial'
  | 'navGroupInsights'
  | 'navGroupData'
  | 'navYearInReview'
  | 'navBrandHome';

export const navigationTranslations: Record<Language, Record<NavigationTranslationKey, string>> = {
  en: {
    navGroupJournaling: 'Journaling',
    navGroupSocial: 'Social',
    navGroupInsights: 'Insights',
    navGroupData: 'Data',
    navYearInReview: 'Year in review',
    navBrandHome: 'Thoughty, go to journal',
  },
  fr: {
    navGroupJournaling: 'Écriture',
    navGroupSocial: 'Social',
    navGroupInsights: 'Analyses',
    navGroupData: 'Données',
    navYearInReview: 'Bilan de l’année',
    navBrandHome: 'Thoughty, aller au journal',
  },
};

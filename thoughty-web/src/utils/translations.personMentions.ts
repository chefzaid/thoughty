import type { Language } from './translations';

/** How often entries mention a person or a group, month by month and year by year, on the People page. */
export type PersonMentionsTranslationKey =
  | 'personMentionsShow'
  | 'personMentionsTitle'
  | 'personMentionsLoading'
  | 'personMentionsFailed'
  | 'personMentionsEmpty'
  | 'groupMentionsEmpty'
  | 'personMentionsLastYear_one'
  | 'personMentionsLastYear_other'
  | 'personMentionsMonths'
  | 'personMentionsMonth_one'
  | 'personMentionsMonth_other'
  | 'personMentionsMonthMood_one'
  | 'personMentionsMonthMood_other'
  | 'personMentionsYears'
  | 'personMentionsYear'
  | 'personMentionsEntries'
  | 'personMentionsAverageMood'
  | 'personMentionsMoodValue'
  | 'personMentionsNoMood'
  | 'personMentionsMoodHelp';

export const personMentionsTranslations: Record<Language, Record<PersonMentionsTranslationKey, string>> = {
  en: {
    personMentionsShow: 'Mentions of {name} over time',
    personMentionsTitle: 'Mentions of {name} over time',
    personMentionsLoading: 'Loading the mentions…',
    personMentionsFailed: 'The mentions could not be loaded. Try again later.',
    personMentionsEmpty: 'No entry mentions {name} yet.',
    groupMentionsEmpty: 'No entry mentions anyone in {name} yet.',
    personMentionsLastYear_one: '{count} entry in the last 12 months',
    personMentionsLastYear_other: '{count} entries in the last 12 months',
    personMentionsMonths: 'The last 12 months',
    personMentionsMonth_one: '{month}: {count} entry',
    personMentionsMonth_other: '{month}: {count} entries',
    personMentionsMonthMood_one: '{month}: {count} entry, average mood {mood}',
    personMentionsMonthMood_other: '{month}: {count} entries, average mood {mood}',
    personMentionsYears: 'By year',
    personMentionsYear: 'Year',
    personMentionsEntries: 'Entries',
    personMentionsAverageMood: 'Average mood',
    personMentionsMoodValue: '{average} out of 5 ({label})',
    personMentionsNoMood: 'No mood',
    personMentionsMoodHelp: 'The mood is the average of the mood check-ins on those entries.',
  },
  fr: {
    personMentionsShow: 'Mentions de {name} au fil du temps',
    personMentionsTitle: 'Mentions de {name} au fil du temps',
    personMentionsLoading: 'Chargement des mentions…',
    personMentionsFailed: 'Les mentions n’ont pas pu être chargées. Réessayez plus tard.',
    personMentionsEmpty: 'Aucune entrée ne mentionne encore {name}.',
    groupMentionsEmpty: 'Aucune entrée ne mentionne encore quelqu’un de {name}.',
    personMentionsLastYear_one: '{count} entrée sur les 12 derniers mois',
    personMentionsLastYear_other: '{count} entrées sur les 12 derniers mois',
    personMentionsMonths: 'Les 12 derniers mois',
    personMentionsMonth_one: '{month} : {count} entrée',
    personMentionsMonth_other: '{month} : {count} entrées',
    personMentionsMonthMood_one: '{month} : {count} entrée, humeur moyenne {mood}',
    personMentionsMonthMood_other: '{month} : {count} entrées, humeur moyenne {mood}',
    personMentionsYears: 'Par année',
    personMentionsYear: 'Année',
    personMentionsEntries: 'Entrées',
    personMentionsAverageMood: 'Humeur moyenne',
    personMentionsMoodValue: '{average} sur 5 ({label})',
    personMentionsNoMood: 'Aucune humeur',
    personMentionsMoodHelp: 'L’humeur est la moyenne des humeurs notées sur ces entrées.',
  },
};

import type { Language } from './translations';

/** Birthdays and anniversaries on people: the People page editor and the Highlights section. */
export type PersonDatesTranslationKey =
  | 'personDateLegend'
  | 'personDateHelp'
  | 'personDateKindLabel'
  | 'personDateKindNone'
  | 'personDateKind_birthday'
  | 'personDateKind_anniversary'
  | 'personDateMonthLabel'
  | 'personDateDayLabel'
  | 'personDateChoose'
  | 'personDateYearLabel'
  | 'personDateYearHelp'
  | 'personDateIncomplete'
  | 'personDateShown'
  | 'personDateSaved'
  | 'personDatesHighlightsTitle'
  | 'personDateAge_one'
  | 'personDateAge_other'
  | 'personDateYears_one'
  | 'personDateYears_other'
  | 'personDateMentions_one'
  | 'personDateMentions_other'
  | 'personDateNoMentions'
  | 'personDateLatestEntry';

export const personDatesTranslations: Record<Language, Record<PersonDatesTranslationKey, string>> = {
  en: {
    personDateLegend: 'Birthday or anniversary',
    personDateHelp: 'Highlights shows {name} on this day each year, with the entries about them. A date on 29 February comes on 28 February in other years.',
    personDateKindLabel: 'Date',
    personDateKindNone: 'None',
    personDateKind_birthday: 'Birthday',
    personDateKind_anniversary: 'Anniversary',
    personDateMonthLabel: 'Month',
    personDateDayLabel: 'Day',
    personDateChoose: 'Choose…',
    personDateYearLabel: 'Year (optional)',
    personDateYearHelp: 'Leave it empty if you do not know the year.',
    personDateIncomplete: 'Choose the month and the day.',
    personDateShown: '{kind}: {date}',
    personDateSaved: 'Saved for {name}.',
    personDatesHighlightsTitle: 'Birthdays and anniversaries',
    personDateAge_one: 'Turns {count} today',
    personDateAge_other: 'Turns {count} today',
    personDateYears_one: '{count} year today',
    personDateYears_other: '{count} years today',
    personDateMentions_one: '{count} entry mentions {name}',
    personDateMentions_other: '{count} entries mention {name}',
    personDateNoMentions: 'No entry mentions {name} for now.',
    personDateLatestEntry: 'Most recent entry',
  },
  fr: {
    personDateLegend: 'Anniversaire ou date anniversaire',
    personDateHelp: 'Les Moments forts montrent {name} ce jour-là chaque année, avec les entrées qui en parlent. Une date au 29 février revient le 28 février les autres années.',
    personDateKindLabel: 'Date',
    personDateKindNone: 'Aucune',
    personDateKind_birthday: 'Anniversaire',
    personDateKind_anniversary: 'Date anniversaire',
    personDateMonthLabel: 'Mois',
    personDateDayLabel: 'Jour',
    personDateChoose: 'Choisir…',
    personDateYearLabel: 'Année (facultative)',
    personDateYearHelp: 'Laissez vide si vous ne connaissez pas l’année.',
    personDateIncomplete: 'Choisissez le mois et le jour.',
    personDateShown: '{kind} : {date}',
    personDateSaved: 'Enregistré pour {name}.',
    personDatesHighlightsTitle: 'Anniversaires du jour',
    personDateAge_one: 'A {count} an aujourd’hui',
    personDateAge_other: 'A {count} ans aujourd’hui',
    personDateYears_one: '{count} an aujourd’hui',
    personDateYears_other: '{count} ans aujourd’hui',
    personDateMentions_one: '{count} entrée mentionne {name}',
    personDateMentions_other: '{count} entrées mentionnent {name}',
    personDateNoMentions: 'Aucune entrée ne mentionne {name} pour l’instant.',
    personDateLatestEntry: 'Entrée la plus récente',
  },
};

import type { Language } from './translations';

/** Birthdays and anniversaries on people (their important dates): the People page editor and the Highlights section. */
export type PersonDatesTranslationKey =
  | 'personDatesLegend'
  | 'personDatesHelp'
  | 'personDatesNone'
  | 'personDatesFull'
  | 'personDatesTooMany'
  | 'personDateNumber'
  | 'personDateAdd'
  | 'personDateRemove'
  | 'personDateKindLabel'
  | 'personDateLabelLabel'
  | 'personDateKind_birthday'
  | 'personDateKind_anniversary'
  | 'personDateMonthLabel'
  | 'personDateDayLabel'
  | 'personDateChoose'
  | 'personDateYearLabel'
  | 'personDateIncomplete'
  | 'personDateShown'
  | 'personDateShownLabeled'
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
    personDatesLegend: 'Important dates',
    personDatesHelp: 'A birthday, and anniversaries such as a wedding or the day you met: Highlights shows {name} on each of these days every year, with the entries about them. Leave the year empty if you do not know it. A date on 29 February comes on 28 February in other years.',
    personDatesNone: 'No date yet.',
    personDatesFull: '{name} has {max} dates, the most you can keep.',
    personDatesTooMany: 'Keep at most {max} dates.',
    personDateNumber: 'Date {number}',
    personDateAdd: 'Add a date',
    personDateRemove: 'Remove date {number}',
    personDateKindLabel: 'Kind',
    personDateLabelLabel: 'What it marks (optional)',
    personDateKind_birthday: 'Birthday',
    personDateKind_anniversary: 'Anniversary',
    personDateMonthLabel: 'Month',
    personDateDayLabel: 'Day',
    personDateChoose: 'Choose…',
    personDateYearLabel: 'Year (optional)',
    personDateIncomplete: 'Choose the month and the day.',
    personDateShown: '{kind}: {date}',
    personDateShownLabeled: '{kind} ({label}): {date}',
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
    personDatesLegend: 'Dates importantes',
    personDatesHelp: 'Un anniversaire, et des dates anniversaires comme un mariage ou le jour de votre rencontre : les Moments forts montrent {name} chacun de ces jours, tous les ans, avec les entrées qui en parlent. Laissez l’année vide si vous ne la connaissez pas. Une date au 29 février revient le 28 février les autres années.',
    personDatesNone: 'Aucune date pour l’instant.',
    personDatesFull: '{name} a {max} dates, le maximum possible.',
    personDatesTooMany: 'Gardez au plus {max} dates.',
    personDateNumber: 'Date {number}',
    personDateAdd: 'Ajouter une date',
    personDateRemove: 'Retirer la date {number}',
    personDateKindLabel: 'Type',
    personDateLabelLabel: 'Ce qu’elle marque (facultatif)',
    personDateKind_birthday: 'Anniversaire',
    personDateKind_anniversary: 'Date anniversaire',
    personDateMonthLabel: 'Mois',
    personDateDayLabel: 'Jour',
    personDateChoose: 'Choisir…',
    personDateYearLabel: 'Année (facultative)',
    personDateIncomplete: 'Choisissez le mois et le jour.',
    personDateShown: '{kind} : {date}',
    personDateShownLabeled: '{kind} ({label}) : {date}',
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

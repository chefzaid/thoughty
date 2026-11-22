import type { Language } from './translations';

/** Reach-out reminders on people: the People page editor and the Highlights section. */
export type PersonReachOutTranslationKey =
  | 'reachOutLegend'
  | 'reachOutHelp'
  | 'reachOutAfterLabel'
  | 'reachOutNever'
  | 'reachOutAfter_14'
  | 'reachOutAfter_30'
  | 'reachOutAfter_60'
  | 'reachOutAfter_90'
  | 'reachOutAfter_180'
  | 'reachOutAfter_365'
  | 'reachOutLastContactLabel'
  | 'reachOutLastContactHelp'
  | 'reachOutShown'
  | 'reachOutLastContactShown'
  | 'reachOutHighlightsTitle'
  | 'reachOutHighlightAfter'
  | 'reachOutDaysSince_one'
  | 'reachOutDaysSince_other'
  | 'reachOutNothingOnRecord'
  | 'reachOutLastMentionedShown'
  | 'reachOutContacted'
  | 'reachOutContactedFor'
  | 'reachOutContactedAnnouncement'
  | 'reachOutContactFailed';

export const personReachOutTranslations: Record<Language, Record<PersonReachOutTranslationKey, string>> = {
  en: {
    reachOutLegend: 'Reach out',
    reachOutHelp: 'Highlights reminds you to reach out to {name} once this long has passed since your last contact or the newest entry that mentions them.',
    reachOutAfterLabel: 'Remind me after',
    reachOutNever: 'Never',
    reachOutAfter_14: '2 weeks',
    reachOutAfter_30: '1 month',
    reachOutAfter_60: '2 months',
    reachOutAfter_90: '3 months',
    reachOutAfter_180: '6 months',
    reachOutAfter_365: '1 year',
    reachOutLastContactLabel: 'Last contact (optional)',
    reachOutLastContactHelp: 'The last day you saw, called or wrote to them. Leave it empty if you do not remember.',
    reachOutShown: 'Reach out after {interval} without contact',
    reachOutLastContactShown: 'Last contact: {date}',
    reachOutHighlightsTitle: 'Time to reach out',
    reachOutHighlightAfter: 'reminder after {interval}',
    reachOutDaysSince_one: 'Last in touch {count} day ago',
    reachOutDaysSince_other: 'Last in touch {count} days ago',
    reachOutNothingOnRecord: 'No contact with {name} and no entry about them on record yet.',
    reachOutLastMentionedShown: 'Last mentioned: {date}',
    reachOutContacted: 'Contacted today',
    reachOutContactedFor: 'Contacted {name} today',
    reachOutContactedAnnouncement: 'Last contact with {name} set to today.',
    reachOutContactFailed: 'The contact could not be saved. Try again.',
  },
  fr: {
    reachOutLegend: 'Garder le contact',
    reachOutHelp: 'Les Moments forts vous rappellent de prendre des nouvelles de {name} quand ce temps est passé depuis votre dernier contact ou la plus récente entrée qui en parle.',
    reachOutAfterLabel: 'Me le rappeler après',
    reachOutNever: 'Jamais',
    reachOutAfter_14: '2 semaines',
    reachOutAfter_30: '1 mois',
    reachOutAfter_60: '2 mois',
    reachOutAfter_90: '3 mois',
    reachOutAfter_180: '6 mois',
    reachOutAfter_365: '1 an',
    reachOutLastContactLabel: 'Dernier contact (facultatif)',
    reachOutLastContactHelp: 'Le dernier jour où vous vous êtes vus, appelés ou écrit. Laissez vide si vous ne vous en souvenez pas.',
    reachOutShown: 'Prendre des nouvelles après {interval} sans contact',
    reachOutLastContactShown: 'Dernier contact : {date}',
    reachOutHighlightsTitle: 'Prendre des nouvelles',
    reachOutHighlightAfter: 'rappel après {interval}',
    reachOutDaysSince_one: 'Dernières nouvelles il y a {count} jour',
    reachOutDaysSince_other: 'Dernières nouvelles il y a {count} jours',
    reachOutNothingOnRecord: 'Aucun contact avec {name} ni aucune entrée qui en parle pour l’instant.',
    reachOutLastMentionedShown: 'Dernière mention : {date}',
    reachOutContacted: 'J’ai pris contact aujourd’hui',
    reachOutContactedFor: 'J’ai pris contact avec {name} aujourd’hui',
    reachOutContactedAnnouncement: 'Dernier contact avec {name} : aujourd’hui.',
    reachOutContactFailed: 'Le contact n’a pas pu être enregistré. Réessayez.',
  },
};

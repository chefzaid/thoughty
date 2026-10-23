import type { Language } from './translations';

export type EntryTitleTimeTranslationKey =
  | 'entryTitleLabel'
  | 'entryTitlePlaceholder'
  | 'entryTimeLabel'
  | 'entryTimeNow'
  | 'entryTimeNowLabel'
  | 'entryTimeClear'
  | 'entryTimeOrderHint'
  | 'entryLinkNumberHint'
  | 'revisionTitle'
  | 'titlePlacement'
  | 'titlePlacementHeader'
  | 'titlePlacementFirstLine';

export const entryTitleTimeTranslations: Record<Language, Record<EntryTitleTimeTranslationKey, string>> = {
  en: {
    entryTitleLabel: 'Title (optional)',
    entryTitlePlaceholder: 'Title (optional)',
    entryTimeLabel: 'Time of day (optional)',
    entryTimeNow: 'Now',
    entryTimeNowLabel: 'Set the time of day to now',
    entryTimeClear: 'Remove the time of day',
    entryTimeOrderHint: 'Entries with a time are listed by it, after the entries without one; drag only reorders those.',
    entryLinkNumberHint: 'Link to this entry with {reference}. Times never change this number.',
    revisionTitle: 'Title: {title}',
    titlePlacement: 'Entry titles',
    titlePlacementHeader: 'On the header line',
    titlePlacementFirstLine: 'First line of the entry',
  },
  fr: {
    entryTitleLabel: 'Titre (facultatif)',
    entryTitlePlaceholder: 'Titre (facultatif)',
    entryTimeLabel: 'Heure (facultative)',
    entryTimeNow: 'Maintenant',
    entryTimeNowLabel: 'Mettre l’heure actuelle',
    entryTimeClear: 'Retirer l’heure',
    entryTimeOrderHint: 'Les entrées qui ont une heure sont classées par heure, après celles qui n’en ont pas ; le glisser-déposer ne réorganise que ces dernières.',
    entryLinkNumberHint: 'Liez cette entrée avec {reference}. Les heures ne changent jamais ce numéro.',
    revisionTitle: 'Titre : {title}',
    titlePlacement: 'Titres des entrées',
    titlePlacementHeader: 'Sur la ligne d’en-tête',
    titlePlacementFirstLine: 'Première ligne de l’entrée',
  },
};

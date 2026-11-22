import type { Language } from './translations';

/** Discussing the entries of the journal filters with the AI: the filter tool, its dialog and the cited entries. */
export type EntryChatTranslationKey =
  | 'entryChatOpen'
  | 'entryChatOpenHint'
  | 'entryChatEmpty'
  | 'entryChatTitle'
  | 'entryChatIntro'
  | 'entryChatRange'
  | 'entryChatFrom'
  | 'entryChatTo'
  | 'entryChatRangeLocked'
  | 'entryChatNotKept'
  | 'entryChatPlaceholder'
  | 'entryChatNewConversation'
  | 'entryChatRead_one'
  | 'entryChatRead_other'
  | 'entryChatReadNewest_one'
  | 'entryChatReadNewest_other'
  | 'entryChatCited'
  | 'entryChatOpenCited'
  | 'entryChatFailed';

export const entryChatTranslations: Record<Language, Record<EntryChatTranslationKey, string>> = {
  en: {
    entryChatOpen: 'Discuss',
    entryChatOpenHint: 'Discuss the entries of the current filters with the AI, which cites the entries it draws on',
    entryChatEmpty: 'No entry matches these filters, so there is nothing to discuss.',
    entryChatTitle: 'Discuss these entries',
    entryChatIntro: 'The AI reads the entries the journal filters show, the newest {max} at most, and cites them by number.',
    entryChatRange: 'Only entries dated',
    entryChatFrom: 'From',
    entryChatTo: 'To',
    entryChatRangeLocked: 'Start a new conversation to change the dates.',
    entryChatNotKept: 'Ask about themes, changes or patterns across these entries. This conversation is not saved.',
    entryChatPlaceholder: 'Ask something about these entries...',
    entryChatNewConversation: 'New conversation',
    entryChatRead_one: 'Read {count} entry',
    entryChatRead_other: 'Read {count} entries',
    entryChatReadNewest_one: 'Read {count} entry, the newest of {total}',
    entryChatReadNewest_other: 'Read {count} entries, the newest of {total}',
    entryChatCited: 'Entries cited',
    entryChatOpenCited: 'Open this entry in the reader',
    entryChatFailed: 'The AI could not answer. Check your OpenRouter API key and try again.',
  },
  fr: {
    entryChatOpen: 'Discuter',
    entryChatOpenHint: 'Discuter avec l’IA des entrées des filtres actuels ; elle cite les entrées sur lesquelles elle s’appuie',
    entryChatEmpty: 'Aucune entrée ne correspond à ces filtres : il n’y a rien à discuter.',
    entryChatTitle: 'Discuter de ces entrées',
    entryChatIntro: 'L’IA lit les entrées que montrent les filtres du journal, les {max} plus récentes au plus, et les cite par leur numéro.',
    entryChatRange: 'Seulement les entrées datées',
    entryChatFrom: 'Du',
    entryChatTo: 'Au',
    entryChatRangeLocked: 'Commencez une nouvelle conversation pour changer les dates.',
    entryChatNotKept: 'Posez une question sur les thèmes, les changements ou les tendances de ces entrées. Cette conversation n’est pas enregistrée.',
    entryChatPlaceholder: 'Posez une question sur ces entrées...',
    entryChatNewConversation: 'Nouvelle conversation',
    entryChatRead_one: '{count} entrée lue',
    entryChatRead_other: '{count} entrées lues',
    entryChatReadNewest_one: '{count} entrée lue, la plus récente sur {total}',
    entryChatReadNewest_other: '{count} entrées lues, les plus récentes sur {total}',
    entryChatCited: 'Entrées citées',
    entryChatOpenCited: 'Ouvrir cette entrée dans la lecture',
    entryChatFailed: 'L’IA n’a pas pu répondre. Vérifiez votre clé API OpenRouter et réessayez.',
  },
};

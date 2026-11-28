import type { Language } from './translations';

/**
 * Messages beyond the Messages page: their notifications in the bell, the entry card's Discuss choices, sharing a
 * public entry with a writer in a message, and the shared entry shown in a conversation.
 */
export type MessageSharingTranslationKey =
  | 'notificationMessage_one'
  | 'notificationMessage_other'
  | 'notificationMessageQuiet'
  | 'discussThisEntry'
  | 'discussWithAi'
  | 'discussWithSomeone'
  | 'discussWithSomeoneTitle'
  | 'discussWithSomeoneRule'
  | 'discussWithSomeoneNotPublic'
  | 'discussWithSomeoneWriters'
  | 'discussWithSomeoneNoWriters'
  | 'discussWithSomeoneMessage'
  | 'discussWithSomeonePlaceholder'
  | 'discussWithSomeoneChooseWriter'
  | 'discussWithSomeoneWriteMessage'
  | 'discussWithSomeoneSend'
  | 'discussWithSomeoneSending'
  | 'messageSharedEntry'
  | 'messageSharedEntryOpen'
  | 'messageSharedEntryGone';

export const messageSharingTranslations: Record<Language, Record<MessageSharingTranslationKey, string>> = {
  en: {
    notificationMessage_one: '{username} sent you a message',
    notificationMessage_other: '{username} sent you {count} messages',
    notificationMessageQuiet: '{username} wrote to you',
    discussThisEntry: 'Discuss this entry',
    discussWithAi: 'With AI',
    discussWithSomeone: 'With someone',
    discussWithSomeoneTitle: 'Discuss with someone',
    discussWithSomeoneRule: 'Only a public entry can be shared, and only with a writer you follow who follows you back: they can already read it in the feed.',
    discussWithSomeoneNotPublic: 'This entry is private. Make it public first to share it in a message.',
    discussWithSomeoneWriters: 'Write to',
    discussWithSomeoneNoWriters: 'Once you and another writer follow each other, you can share your public entries with them here.',
    discussWithSomeoneMessage: 'Your message',
    discussWithSomeonePlaceholder: 'What would you like to talk about?',
    discussWithSomeoneChooseWriter: 'Choose who to write to.',
    discussWithSomeoneWriteMessage: 'Write a message to go with the entry.',
    discussWithSomeoneSend: 'Send and open the conversation',
    discussWithSomeoneSending: 'Sending…',
    messageSharedEntry: 'Shared entry: {entry}',
    messageSharedEntryOpen: 'Open in the feed',
    messageSharedEntryGone: 'The entry shared here is no longer public.',
  },
  fr: {
    notificationMessage_one: '{username} vous a envoyé un message',
    notificationMessage_other: '{username} vous a envoyé {count} messages',
    notificationMessageQuiet: '{username} vous a écrit',
    discussThisEntry: 'Discuter de cette entrée',
    discussWithAi: 'Avec l’IA',
    discussWithSomeone: 'Avec quelqu’un',
    discussWithSomeoneTitle: 'Discuter avec quelqu’un',
    discussWithSomeoneRule: 'Seule une entrée publique peut être partagée, et seulement avec une personne que vous suivez et qui vous suit : elle peut déjà la lire dans le fil.',
    discussWithSomeoneNotPublic: 'Cette entrée est privée. Rendez-la publique pour la partager dans un message.',
    discussWithSomeoneWriters: 'Écrire à',
    discussWithSomeoneNoWriters: 'Dès que vous et une autre personne vous suivez mutuellement, vous pouvez lui partager ici vos entrées publiques.',
    discussWithSomeoneMessage: 'Votre message',
    discussWithSomeonePlaceholder: 'De quoi aimeriez-vous parler ?',
    discussWithSomeoneChooseWriter: 'Choisissez à qui écrire.',
    discussWithSomeoneWriteMessage: 'Écrivez un message pour accompagner l’entrée.',
    discussWithSomeoneSend: 'Envoyer et ouvrir la conversation',
    discussWithSomeoneSending: 'Envoi…',
    messageSharedEntry: 'Entrée partagée : {entry}',
    messageSharedEntryOpen: 'Ouvrir dans le fil',
    messageSharedEntryGone: 'L’entrée partagée ici n’est plus publique.',
  },
};

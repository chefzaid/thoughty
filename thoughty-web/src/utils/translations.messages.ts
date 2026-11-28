import type { Language } from './translations';

/** Messages between writers who follow each other: the Messages page, its conversations and the menu's count. */
export type MessagesTranslationKey =
  | 'messages'
  | 'messagesSubtitle'
  | 'messagesStartTitle'
  | 'messagesStartEmpty'
  | 'messagesWriteTo'
  | 'messagesConversationsTitle'
  | 'messagesConversationsEmpty'
  | 'messagesChoose'
  | 'messagesUnread_one'
  | 'messagesUnread_other'
  | 'messagesUnreadQuiet'
  | 'messagesNavUnread_one'
  | 'messagesNavUnread_other'
  | 'messagesNavUnreadQuiet'
  | 'messagesFromYou'
  | 'messagesThreadLabel'
  | 'messagesThreadEmpty'
  | 'messagesEarlier'
  | 'messagesComposerLabel'
  | 'messagesComposerPlaceholder'
  | 'messagesComposerHint'
  | 'messagesSend'
  | 'messagesSending'
  | 'messagesReadOnly'
  | 'messagesBack'
  | 'messagesLoadError'
  | 'messagesOpenError'
  | 'messageSendError';

export const messagesTranslations: Record<Language, Record<MessagesTranslationKey, string>> = {
  en: {
    messages: 'Messages',
    messagesSubtitle: 'Write to the writers you follow who follow you back.',
    messagesStartTitle: 'Write to',
    messagesStartEmpty: 'Once you and another writer follow each other, you can write to them here.',
    messagesWriteTo: 'Write to {username}',
    messagesConversationsTitle: 'Conversations',
    messagesConversationsEmpty: 'No conversations yet.',
    messagesChoose: 'Choose a conversation, or write to someone.',
    messagesUnread_one: '{count} new',
    messagesUnread_other: '{count} new',
    messagesUnreadQuiet: 'New',
    messagesNavUnread_one: '{count} unread message',
    messagesNavUnread_other: '{count} unread messages',
    messagesNavUnreadQuiet: 'Unread messages',
    messagesFromYou: 'You: {text}',
    messagesThreadLabel: 'Conversation with {username}',
    messagesThreadEmpty: 'No messages yet. Say hello to {username}.',
    messagesEarlier: 'Show earlier messages',
    messagesComposerLabel: 'Message to {username}',
    messagesComposerPlaceholder: 'Write a message',
    messagesComposerHint: 'Enter sends, Shift+Enter starts a new line.',
    messagesSend: 'Send',
    messagesSending: 'Sending…',
    messagesReadOnly: 'You no longer follow each other, so you can read this conversation but not answer it.',
    messagesBack: 'All conversations',
    messagesLoadError: 'Your messages could not be loaded. Try again later.',
    messagesOpenError: 'This conversation could not be opened.',
    messageSendError: 'Your message could not be sent. Try again.',
  },
  fr: {
    messages: 'Messages',
    messagesSubtitle: 'Écrivez aux auteurs que vous suivez et qui vous suivent aussi.',
    messagesStartTitle: 'Écrire à',
    messagesStartEmpty: 'Dès qu’un autre auteur et vous vous suivez l’un l’autre, vous pouvez lui écrire ici.',
    messagesWriteTo: 'Écrire à {username}',
    messagesConversationsTitle: 'Conversations',
    messagesConversationsEmpty: 'Aucune conversation pour l’instant.',
    messagesChoose: 'Choisissez une conversation, ou écrivez à quelqu’un.',
    messagesUnread_one: '{count} nouveau',
    messagesUnread_other: '{count} nouveaux',
    messagesUnreadQuiet: 'Nouveau',
    messagesNavUnread_one: '{count} message non lu',
    messagesNavUnread_other: '{count} messages non lus',
    messagesNavUnreadQuiet: 'Messages non lus',
    messagesFromYou: 'Vous : {text}',
    messagesThreadLabel: 'Conversation avec {username}',
    messagesThreadEmpty: 'Aucun message pour l’instant. Dites bonjour à {username}.',
    messagesEarlier: 'Afficher les messages précédents',
    messagesComposerLabel: 'Message à {username}',
    messagesComposerPlaceholder: 'Écrire un message',
    messagesComposerHint: 'Entrée envoie, Maj+Entrée passe à la ligne.',
    messagesSend: 'Envoyer',
    messagesSending: 'Envoi…',
    messagesReadOnly: 'Vous ne vous suivez plus l’un l’autre : vous pouvez lire cette conversation, mais plus y répondre.',
    messagesBack: 'Toutes les conversations',
    messagesLoadError: 'Vos messages n’ont pas pu être chargés. Réessayez plus tard.',
    messagesOpenError: 'Cette conversation n’a pas pu être ouverte.',
    messageSendError: 'Votre message n’a pas pu être envoyé. Réessayez.',
  },
};

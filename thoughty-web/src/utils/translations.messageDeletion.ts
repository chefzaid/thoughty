import type { Language } from './translations';

/** Deleting a message, or a whole conversation, for oneself on the Messages page. */
export type MessageDeletionTranslationKey =
  | 'messageDelete'
  | 'messageDeleteTitle'
  | 'messageDeleteConfirm'
  | 'messageDeleteError'
  | 'conversationDelete'
  | 'conversationDeleteTitle'
  | 'conversationDeleteConfirm'
  | 'conversationDeleteError';

export const messageDeletionTranslations: Record<Language, Record<MessageDeletionTranslationKey, string>> = {
  en: {
    messageDelete: 'Delete this message for you',
    messageDeleteTitle: 'Delete this message?',
    messageDeleteConfirm: 'It leaves your conversation only: {username} still has it.',
    messageDeleteError: 'This message could not be deleted. Try again.',
    conversationDelete: 'Delete conversation',
    conversationDeleteTitle: 'Delete this conversation?',
    conversationDeleteConfirm:
      'Its messages leave your Messages only: {username} still has them. If {username} writes again, the conversation comes back with the new messages only.',
    conversationDeleteError: 'This conversation could not be deleted. Try again.',
  },
  fr: {
    messageDelete: 'Supprimer ce message pour vous',
    messageDeleteTitle: 'Supprimer ce message ?',
    messageDeleteConfirm: 'Il disparaît de votre conversation seulement : {username} le garde.',
    messageDeleteError: 'Ce message n’a pas pu être supprimé. Réessayez.',
    conversationDelete: 'Supprimer la conversation',
    conversationDeleteTitle: 'Supprimer cette conversation ?',
    conversationDeleteConfirm:
      'Ses messages disparaissent de vos Messages seulement : {username} les garde. Si {username} vous écrit à nouveau, la conversation revient avec les nouveaux messages seulement.',
    conversationDeleteError: 'Cette conversation n’a pas pu être supprimée. Réessayez.',
  },
};

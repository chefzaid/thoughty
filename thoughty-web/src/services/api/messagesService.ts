import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type Conversation = components['schemas']['ConversationSummaryDto'];
export type ConversationList = components['schemas']['ConversationListDto'];
export type ConversationThread = components['schemas']['ConversationThreadDto'];
export type ChatMessage = components['schemas']['MessageDto'];
export type MessageSharedEntry = components['schemas']['MessageEntryDto'];
export type UnreadMessages = components['schemas']['UnreadMessagesDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Messages between writers who follow each other: the conversations, one conversation's messages, sending and
 * marking read. Errors are translation keys, or the API's coded reason.
 */
export const createMessagesService = (authFetch: AuthFetchFunction) => ({
  list(): Promise<ServiceResult<ConversationList>> {
    return requestJson(authFetch('/api/conversations'), 'messagesLoadError');
  },

  countUnread(): Promise<ServiceResult<UnreadMessages>> {
    return requestJson(authFetch('/api/conversations/unread'), 'messagesLoadError');
  },

  /** The conversation with a writer, made the first time. */
  open(userId: number): Promise<ServiceResult<Conversation>> {
    return requestJson(authFetch(`/api/conversations/with/${userId}`, { method: 'PUT' }), 'messagesOpenError');
  },

  /** The newest messages, or those before the message `before`. */
  thread(conversationId: number, before?: number): Promise<ServiceResult<ConversationThread>> {
    const url = before ? `/api/conversations/${conversationId}?before=${before}` : `/api/conversations/${conversationId}`;
    return requestJson(authFetch(url), 'messagesLoadError');
  },

  /** Sends a message, sharing one of the writer's public entries when `entryId` is given. */
  send(conversationId: number, body: string, entryId?: number): Promise<ServiceResult<ChatMessage>> {
    return requestJson(
      authFetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(entryId === undefined ? { body } : { body, entryId }),
      }),
      'messageSendError',
    );
  },

  markRead(conversationId: number): Promise<ServiceResult<UnreadMessages>> {
    return requestJson(authFetch(`/api/conversations/${conversationId}/read`, { method: 'PUT' }), 'messagesLoadError');
  },
});

export type MessagesService = ReturnType<typeof createMessagesService>;

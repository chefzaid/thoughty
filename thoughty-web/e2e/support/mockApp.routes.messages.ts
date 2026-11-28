import type { components } from '../../src/generated/openapi';

import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState } from './mockApp.shared';

type ConversationWriter = components['schemas']['ConversationWriterDto'];

interface MockMessage {
  id: number;
  senderId: number;
  body: string;
  createdAt: string;
  /** The sender's public entry the message shares. */
  entryId?: number;
}

/** A seeded conversation: who with, its messages oldest first, and the newest one the reader has read. */
export interface MockConversation {
  id: number;
  writer: ConversationWriter;
  messages: MockMessage[];
  lastReadMessageId: number;
}

/** Messages in the mock API: the reader's conversations, the ids the next ones take, and when the bell was opened. */
export interface MockMessagesState {
  conversations: MockConversation[];
  nextConversationId: number;
  nextMessageId: number;
  notificationsReadAt: string | null;
}

export function createMockMessagesState(conversations: MockConversation[] = []): MockMessagesState {
  const copies = conversations.map((conversation) => ({ ...conversation, messages: [...conversation.messages] }));
  const messageIds = copies.flatMap((conversation) => conversation.messages.map((message) => message.id));
  return {
    conversations: copies,
    nextConversationId: Math.max(0, ...copies.map((conversation) => conversation.id)) + 1,
    nextMessageId: Math.max(0, ...messageIds) + 1,
    notificationsReadAt: null,
  };
}

const PAGE_SIZE = 50;

/** The writers the reader follows who follow them back, as `GET /api/follows` lists them. */
function writerToMessage(state: MockAppState, id: number): ConversationWriter | null {
  const follower = state.writers.followers.find((writer) => writer.id === id);
  return follower && state.followedUserIds.includes(id)
    ? { id: follower.id, username: follower.username, avatarUrl: follower.avatarUrl }
    : null;
}

/** The reader's own public entry `entryId`, which a message may share and the other writer can read. */
function publicEntry(state: MockAppState, entryId: number | undefined) {
  const entry = state.entries.find((candidate) => candidate.id === entryId);
  return entry && entry.visibility === 'public' && !entry.is_archived ? entry : null;
}

const toMessage = (state: MockAppState, conversationId: number, { entryId, ...message }: MockMessage) => {
  const entry = publicEntry(state, entryId);
  return {
    ...message,
    conversationId,
    mine: message.senderId === state.user.id,
    entry: entry ? { id: entry.id, date: entry.date, index: entry.index, title: entry.title ?? null } : null,
    entryUnavailable: entryId !== undefined && !entry,
  };
};

const unreadIn = (state: MockAppState, conversation: MockConversation) =>
  conversation.messages.filter((message) => message.senderId !== state.user.id && message.id > conversation.lastReadMessageId).length;

function toSummary(state: MockAppState, conversation: MockConversation) {
  const last = conversation.messages.at(-1);
  return {
    id: conversation.id,
    writer: conversation.writer,
    lastMessage: last ? toMessage(state, conversation.id, last) : null,
    unreadCount: unreadIn(state, conversation),
    canWrite: writerToMessage(state, conversation.writer.id) !== null,
  };
}

const unreadCount = (state: MockAppState) =>
  state.messages.conversations.reduce((count, conversation) => count + unreadIn(state, conversation), 0);

/**
 * The bell's message notifications, as the API reads them: one per conversation with unread messages, dated by
 * the newest, new when it came after the bell was last opened.
 */
export function messageNotifications(state: MockAppState): components['schemas']['NotificationDto'][] {
  return state.messages.conversations.flatMap((conversation) => {
    const unread = conversation.messages.filter((message) => message.senderId !== state.user.id && message.id > conversation.lastReadMessageId);
    const newest = unread.at(-1);
    if (!newest) return [];
    const readAt = state.messages.notificationsReadAt;
    return [{
      id: `message:${conversation.id}`,
      type: 'message' as const,
      createdAt: newest.createdAt,
      unread: readAt === null || newest.createdAt > readAt,
      actor: conversation.writer,
      entry: null,
      comment: null,
      conversation: { id: conversation.id, messageCount: unread.length, excerpt: newest.body.slice(0, 140) },
    }];
  });
}

/** `GET /api/conversations/{id}`, `POST …/messages` and `PUT …/read` for one of the reader's conversations. */
async function handleConversationRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  const match = /^\/api\/conversations\/(\d+)(\/messages|\/read)?$/.exec(pathname);
  if (!match) return false;
  const conversation = state.messages.conversations.find((candidate) => candidate.id === Number(match[1]));
  const method = request.method();
  if (!conversation) {
    await fulfillApiError(route, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    return true;
  }
  if (!match[2] && method === 'GET') {
    const before = Number(searchParams.get('before') ?? Number.POSITIVE_INFINITY);
    const older = conversation.messages.filter((message) => message.id < before);
    const page = older.slice(-PAGE_SIZE);
    await fulfillJson(route, {
      conversation: toSummary(state, conversation),
      messages: page.map((message) => toMessage(state, conversation.id, message)),
      hasMore: older.length > page.length,
    });
    return true;
  }
  if (match[2] === '/messages' && method === 'POST') {
    const posted = request.postDataJSON() as { body?: unknown; entryId?: number };
    const body = String(posted.body ?? '').trim();
    if (!toSummary(state, conversation).canWrite) {
      await fulfillApiError(route, 403, 'CONVERSATION_READ_ONLY', 'You can write only to a writer who follows you and whom you follow');
      return true;
    }
    if (!body || body.length > 2000) {
      await fulfillApiError(route, 400, 'VALIDATION_FAILED', ['body must be shorter than or equal to 2000 characters']);
      return true;
    }
    if (posted.entryId !== undefined) {
      const own = state.entries.find((entry) => entry.id === posted.entryId && (entry.userId ?? state.user.id) === state.user.id);
      if (!own) {
        await fulfillApiError(route, 404, 'ENTRY_NOT_FOUND', 'Entry not found');
        return true;
      }
      if (!publicEntry(state, own.id)) {
        await fulfillApiError(route, 400, 'MESSAGE_ENTRY_NOT_PUBLIC', 'Only a public entry can be shared in a message');
        return true;
      }
    }
    const message = {
      id: state.messages.nextMessageId++,
      senderId: state.user.id,
      body,
      createdAt: new Date().toISOString(),
      ...(posted.entryId === undefined ? {} : { entryId: posted.entryId }),
    };
    conversation.messages.push(message);
    conversation.lastReadMessageId = message.id;
    await fulfillJson(route, toMessage(state, conversation.id, message), { status: 201 });
    return true;
  }
  if (match[2] === '/read' && method === 'PUT') {
    conversation.lastReadMessageId = conversation.messages.at(-1)?.id ?? 0;
    await fulfillJson(route, { unreadCount: unreadCount(state) });
    return true;
  }
  return false;
}

/** Messages between the reader and the writers they follow who follow them back. */
export async function handleMessageRoutes(context: RouteContext): Promise<boolean> {
  const { route, request, pathname, state } = context;
  if (pathname === '/api/conversations' && request.method() === 'GET') {
    const conversations = state.messages.conversations
      .filter((conversation) => conversation.messages.length > 0)
      .sort((left, right) => (right.messages.at(-1)?.id ?? 0) - (left.messages.at(-1)?.id ?? 0));
    await fulfillJson(route, { conversations: conversations.map((conversation) => toSummary(state, conversation)) });
    return true;
  }
  if (pathname === '/api/conversations/unread' && request.method() === 'GET') {
    await fulfillJson(route, { unreadCount: unreadCount(state) });
    return true;
  }
  const opening = /^\/api\/conversations\/with\/(\d+)$/.exec(pathname);
  if (opening && request.method() === 'PUT') {
    const writer = writerToMessage(state, Number(opening[1]));
    if (!writer) {
      await fulfillApiError(route, 404, 'USER_NOT_FOUND', 'User not found');
      return true;
    }
    let conversation = state.messages.conversations.find((candidate) => candidate.writer.id === writer.id);
    if (!conversation) {
      conversation = { id: state.messages.nextConversationId++, writer, messages: [], lastReadMessageId: 0 };
      state.messages.conversations.push(conversation);
    }
    await fulfillJson(route, toSummary(state, conversation));
    return true;
  }
  return handleConversationRoutes(context);
}

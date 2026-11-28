import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createMessagesService, type ChatMessage, type ServiceResult } from '../../services/api';
import { useFeatureFlag } from '../FeatureFlags/featureFlags';

export const CONVERSATIONS_QUERY_KEY = ['conversations'] as const;
export const UNREAD_MESSAGES_QUERY_KEY = ['conversations', 'unread'] as const;
const threadKey = (conversationId: number) => ['conversations', 'thread', conversationId] as const;

/** How often the open conversation, the list and the unread count are read again while the page is in front. */
export const THREAD_POLL_MS = 20_000;
export const CONVERSATIONS_POLL_MS = 30_000;
export const UNREAD_MESSAGES_POLL_MS = 60_000;

/** Unwraps a service answer for a query: its data, or an error carrying the translation key. */
async function dataOf<T>(request: Promise<ServiceResult<T>>, fallback: string): Promise<T> {
  const result = await request;
  if (!result.data) throw new Error(result.error ?? fallback);
  return result.data;
}

/**
 * How many messages are unread across every conversation, for the navigation: read on load and every minute
 * while the page is in front; 0 while public sharing is switched off, when nothing is asked.
 */
export function useUnreadMessages(): number {
  const service = useAuthenticatedService(createMessagesService);
  const publicSharing = useFeatureFlag('publicSharing');
  const unread = useQuery({
    queryKey: UNREAD_MESSAGES_QUERY_KEY,
    queryFn: () => dataOf(service.countUnread(), 'messagesLoadError'),
    enabled: publicSharing,
    refetchInterval: UNREAD_MESSAGES_POLL_MS,
  });
  return publicSharing ? unread.data?.unreadCount ?? 0 : 0;
}

/** The writer's conversations, the most recent first, and opening one with a writer. */
export function useConversations() {
  const service = useAuthenticatedService(createMessagesService);
  const list = useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: () => dataOf(service.list(), 'messagesLoadError'),
    refetchInterval: CONVERSATIONS_POLL_MS,
  });
  const open = useCallback((userId: number) => service.open(userId), [service]);
  return { list, open };
}

/**
 * One conversation: its newest messages, read again every 20 seconds while the page is in front, the earlier
 * ones loaded on request, sending, and marking it read whenever it shows unread messages.
 */
export function useConversationThread(conversationId: number) {
  const service = useAuthenticatedService(createMessagesService);
  const queryClient = useQueryClient();
  const thread = useQuery({
    queryKey: threadKey(conversationId),
    queryFn: () => dataOf(service.thread(conversationId), 'messagesLoadError'),
    refetchInterval: THREAD_POLL_MS,
  });
  // The earlier messages loaded, for the conversation they belong to: another one starts without them
  const [loaded, setLoaded] = useState<{ conversationId: number; messages: ChatMessage[]; hasMore: boolean } | null>(null);
  const earlier = loaded?.conversationId === conversationId ? loaded : null;
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const unreadCount = thread.data?.conversation.unreadCount ?? 0;
  const newestId = thread.data?.conversation.lastMessage?.id;
  useEffect(() => {
    if (unreadCount === 0) return;
    void service.markRead(conversationId).then((result) => {
      if (!result.data) return;
      queryClient.setQueryData(UNREAD_MESSAGES_QUERY_KEY, result.data);
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY, exact: true });
    });
  }, [conversationId, newestId, queryClient, service, unreadCount]);

  const messages = useMemo(() => {
    const newest = thread.data?.messages ?? [];
    const before = (earlier?.messages ?? []).filter((message) => !newest.some((shown) => shown.id === message.id));
    return [...before, ...newest];
  }, [earlier, thread.data]);
  const hasMore = earlier ? earlier.hasMore : thread.data?.hasMore ?? false;

  const loadEarlier = useCallback(async () => {
    const first = messages[0];
    if (!first) return;
    setLoadingEarlier(true);
    const result = await service.thread(conversationId, first.id);
    if (!mountedRef.current) return;
    setLoadingEarlier(false);
    if (result.data) {
      const page = result.data;
      // Everything shown so far is kept with them, so a newest page that moves on as messages arrive leaves no gap
      setLoaded({ conversationId, messages: [...page.messages, ...messages], hasMore: page.hasMore });
    }
  }, [conversationId, messages, service]);

  /** Sends a message; resolves to null once sent, or to the translation key of why it was not. */
  const send = useCallback(async (body: string): Promise<string | null> => {
    const result = await service.send(conversationId, body);
    if (!result.data) return result.error ?? 'messageSendError';
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: threadKey(conversationId) }),
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY, exact: true }),
    ]);
    return null;
  }, [conversationId, queryClient, service]);

  return { thread, messages, hasMore, loadingEarlier, loadEarlier, send };
}

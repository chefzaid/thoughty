import type { LocalModelMessage } from './localModelClient';

/** A message of an entry's chat with the writer's own model. */
export type LocalChatMessage = LocalModelMessage & { readonly role: 'user' | 'assistant' };

/**
 * The chats about the entries of a diary on the writer's own model: kept in this browser only, per writer and per
 * entry (`thoughty.localModelChat.<userId>.<entryId>`), never sent to Thoughty's server, and dropped from this
 * browser when the writer signs out (`forgetLocalChats`).
 */
const STORAGE_PREFIX = 'thoughty.localModelChat.';

const storageKey = (userId: number, entryId: number) => `${STORAGE_PREFIX}${userId}.${entryId}`;

const isMessage = (value: unknown): value is LocalChatMessage => {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string';
};

/** The chat about an entry this browser keeps, empty when there is none (or it cannot be read). */
export function readLocalChat(userId: number | null, entryId: number): LocalChatMessage[] {
  if (userId === null) return [];
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(storageKey(userId, entryId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isMessage).map(({ role, content }) => ({ role, content })) : [];
  } catch {
    return [];
  }
}

/** Keeps the chat about an entry in this browser; false when the browser keeps nothing (storage blocked or full). */
export function writeLocalChat(userId: number | null, entryId: number, messages: readonly LocalChatMessage[]): boolean {
  if (userId === null) return false;
  try {
    globalThis.localStorage?.setItem(storageKey(userId, entryId), JSON.stringify(messages));
    return true;
  } catch {
    return false;
  }
}

/** Drops every writer's entry chats from this browser as the writer signs out. */
export function forgetLocalChats(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key?.startsWith(STORAGE_PREFIX) ?? false);
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Nothing to forget when storage is blocked
  }
}

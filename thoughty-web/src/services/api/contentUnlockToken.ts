/** The header that carries the PIN unlock to the API. */
export const CONTENT_UNLOCK_HEADER = 'X-Content-Unlock';

type Listener = (token: string | null) => void;

let unlockToken: string | null = null;
const listeners = new Set<Listener>();

/**
 * The PIN unlock of locked diaries and entries, kept in this tab's memory only: a reload, closing the tab or
 * signing out ends it, and no other tab or storage ever holds it. Every authenticated request sends it.
 */
export function getContentUnlockToken(): string | null {
  return unlockToken;
}

export function setContentUnlockToken(token: string | null): void {
  if (token === unlockToken) return;
  unlockToken = token;
  for (const listener of listeners) listener(token);
}

/** Hears every change of the unlock; returns how to stop. */
export function subscribeContentUnlockToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

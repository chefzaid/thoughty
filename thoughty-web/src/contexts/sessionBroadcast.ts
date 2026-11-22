/**
 * What one tab tells this browser's other tabs about the session they share through the refresh
 * token cookie: a writer signed out (so the cookie is gone), or a writer signed in (so the cookie
 * now belongs to them).
 */
export type SessionMessage =
  | { readonly type: 'signed-out' }
  | { readonly type: 'signed-in'; readonly userId: number };

export interface SessionChannel {
  post: (message: SessionMessage) => void;
  close: () => void;
}

const CHANNEL_NAME = 'thoughty.auth-session';

function isSessionMessage(value: unknown): value is SessionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message.type === 'signed-out'
    || (message.type === 'signed-in' && typeof message.userId === 'number');
}

const NO_CHANNEL: SessionChannel = { post: () => undefined, close: () => undefined };

/**
 * Opens the channel this browser's tabs of the app share (same origin only). A browser without
 * `BroadcastChannel` gets one that does nothing: each tab then finds out at its next refresh.
 */
export function openSessionChannel(onMessage: (message: SessionMessage) => void): SessionChannel {
  if (typeof BroadcastChannel === 'undefined') return NO_CHANNEL;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (isSessionMessage(event.data)) onMessage(event.data);
  };
  return {
    post: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}

import { buildAuthHeaders, safeJsonParse } from '../services/api/base';
import { API_BASE } from './authRequests';
import type { User } from './authTypes';
import { clearSessionUserThrottle, noteSessionUserThrottled, sessionUserWaitMs } from './refreshThrottle';

/**
 * What `GET /api/auth/me` says of a session. Only a `401` or `403` says it is gone (`refused`). A `429`
 * (`wait`, for as long as the API asked, shared by the browser's tabs) and a server that is down, any other
 * answer, one that cannot be read or none at all (`unanswered`) say nothing about it: the session goes on
 * unconfirmed, and `/me` is read again later.
 */
export type SessionUserAnswer =
  | { kind: 'user'; user: User }
  | { kind: 'refused' }
  | { kind: 'wait'; retryInMs: number }
  | { kind: 'unanswered' };

export const UNANSWERED: SessionUserAnswer = { kind: 'unanswered' };

/** Reads in flight, by token: callers asking at the same time (a load and a retry) share one request. */
const inFlight = new Map<string, Promise<SessionUserAnswer>>();

/** Reads whose session a token is for; sends nothing while a wait the API asked for runs. */
export function readSessionUser(token: string): Promise<SessionUserAnswer> {
  let pending = inFlight.get(token);
  if (!pending) {
    pending = sendSessionUserRead(token).finally(() => inFlight.delete(token));
    inFlight.set(token, pending);
  }
  return pending;
}

async function sendSessionUserRead(token: string): Promise<SessionUserAnswer> {
  const wait = sessionUserWaitMs();
  if (wait > 0) return { kind: 'wait', retryInMs: wait };
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/me`, { headers: buildAuthHeaders({}, token) });
  } catch {
    return UNANSWERED;
  }
  if (response.status === 429) {
    return { kind: 'wait', retryInMs: noteSessionUserThrottled(response.headers.get('Retry-After')) };
  }
  clearSessionUserThrottle();
  if (response.status === 401 || response.status === 403) return { kind: 'refused' };
  const user = response.ok ? await safeJsonParse<User>(response) : null;
  return user ? { kind: 'user', user } : UNANSWERED;
}

/**
 * The account an access token was signed for (its `userId` claim), or null when it cannot be read. The
 * signature is not checked: this only keeps the page from showing a writer remembered here for a session
 * that is someone else's; the API checks the token itself on every request.
 */
export function tokenUserId(token: string | null): number | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
    const userId = (claims as { userId?: unknown } | null)?.userId;
    return Number.isInteger(userId) ? (userId as number) : null;
  } catch {
    return null;
  }
}

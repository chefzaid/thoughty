import { useCallback, useEffect, useRef, useState } from 'react';
import { buildAuthHeaders, safeJsonParse } from '../services/api/base';
import { setContentUnlockToken } from '../services/api/contentUnlockToken';
import { API_BASE } from './authRequests';
import type { TokenResponse, User } from './authTypes';
import {
  clearKeycloakSsoAttempt,
  hasPendingKeycloakSsoAttempt,
  markKeycloakSsoFailed,
  takeKeycloakSsoPreferencesQuery,
} from '../utils/keycloakSso';
import { forgetLocalComposerDrafts } from '../components/ComposerDraft/composerDraftStorage';
import { openSessionChannel, type SessionChannel } from './sessionBroadcast';
import {
  clearSignOutPending,
  forgetOfflineSession,
  isSignOutPending,
  markSignOutPending,
  readOfflineUser,
  rememberOfflineUser,
} from './offlineSession';
import { backoffMs, clearRefreshThrottle, noteRefreshThrottled, refreshWaitMs } from './refreshThrottle';
import { readSessionUser, tokenUserId, UNANSWERED, type SessionUserAnswer } from './sessionUser';

/** Keys where older versions kept tokens in localStorage; they are removed on load. */
const LEGACY_TOKEN_KEYS = ['accessToken', 'refreshToken'] as const;
const REFRESH_LOCK_NAME = 'thoughty.auth-refresh';

/**
 * Deletes tokens an older version left in localStorage. They are never sent anywhere: refresh
 * reads only the httpOnly cookie, so a leftover refresh token is just a secret to erase.
 */
export function removeLegacyStoredTokens(): void {
  try {
    for (const key of LEGACY_TOKEN_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage is blocked (site data disabled): the page can neither read nor delete it.
  }
}

/**
 * A refresh's outcome: a new access token, or none, and whether the server refused the session. Only a
 * `401` or `403` refuses it. A request that never got an answer, one from a server that is down (5xx),
 * and any other answer say nothing about the session; nor does a `429`, which also says how long to wait.
 */
interface RefreshOutcome {
  token: string | null;
  refused: boolean;
  /** Set when the API asked to wait (`429`, or a wait still running): how long until a refresh may go. */
  retryInMs?: number;
}

const NO_ANSWER: RefreshOutcome = { token: null, refused: false };

/**
 * Refresh tokens are single-use, so refreshes from several tabs must not race with the same
 * cookie. The Web Locks API runs them one at a time across tabs; each then sends the cookie the
 * previous one received.
 */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(REFRESH_LOCK_NAME, task) as Promise<T> : task();
}

/**
 * Asks the server to revoke the refresh token in its cookie and clear the cookie, after a refresh in
 * flight. A sign-out that reaches no working API is kept and sent again on the next load.
 */
async function revokeRefreshCookie(): Promise<void> {
  try {
    const response = await withRefreshLock(() => fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    }));
    if (response.status < 500) {
      clearSignOutPending();
      return;
    }
  } catch (err) {
    console.error('Logout error:', err);
  }
  markSignOutPending();
}

export async function exchangeKeycloakSession(
  onSession: (session: TokenResponse) => void,
): Promise<void> {
  try {
    // The visitor's language and theme, for an account the exchange creates
    const preferences = takeKeycloakSsoPreferencesQuery();
    const response = await fetch(preferences ? `${API_BASE}/sso?${preferences}` : `${API_BASE}/sso`);
    if (!response.ok) {
      return;
    }
    const session = await safeJsonParse<TokenResponse>(response);
    if (session) {
      onSession(session);
    }
  } catch (err) {
    console.error('Keycloak SSO exchange failed:', err);
  }
}

/**
 * The signed-in user and their tokens: restores the session on load, refreshes the access token
 * when a request gets a 401, and signs out. Every way a session ends goes through `endSession`,
 * which moves `sessionKey` on: the app keys its query cache and its writer state on it, so nothing
 * read or typed for that writer outlives the session. This browser's other tabs hear of a sign-out
 * or another writer's sign-in (`sessionBroadcast`) and end theirs too.
 */
export function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionKey, setSessionKey] = useState(0);
  /**
   * Set while the journal is open for the writer last signed in on this browser without the API having
   * confirmed the session, because it could not be reached when the app opened, because it asked to
   * wait before the next refresh (429, on load or when a token expired), or because `/me` did not say
   * whose the session is (429, 5xx, no answer). It ends when `/me` confirms the session, or when the server
   * refuses it (401, 403), which ends the session there.
   */
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);
  /**
   * Set while the session goes on (the refresh gave a token) but `/me` could not say whose it is yet and no
   * writer remembered here is the one the token is for: the page says Thoughty cannot be reached, rather
   * than asking a writer who is signed in to sign in again, and tries again (`retryAt`).
   */
  const [unreachable, setUnreachableState] = useState(false);
  const unreachableRef = useRef(false);

  // The access token lives in memory only; the refresh token is an httpOnly cookie the page
  // cannot read, so a reload gets a new access token through refreshSession.
  const accessTokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<RefreshOutcome> | null>(null);
  /** Grows with each ended session, so a refresh or request that outlived it changes nothing. */
  const sessionEpochRef = useRef(0);
  const userIdRef = useRef<number | null>(null);
  const channelRef = useRef<SessionChannel | null>(null);
  const reconnectInFlightRef = useRef<Promise<string | null> | null>(null);
  /**
   * When the session is tried again: once a refresh or `/me` may go after a `429`, or after a backoff when
   * `/me` (or the refresh on the way back) got no answer, so an unconfirmed session gets confirmed on its own.
   */
  const [retryAt, setRetryAt] = useState<{ at: number } | null>(null);
  /** Tries in a row that got no answer, for that backoff. */
  const retryStrikesRef = useRef(0);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  // The writer a confirmed session belongs to is remembered for a journal opened without a connection
  useEffect(() => {
    if (user && !offline) rememberOfflineUser(user);
  }, [offline, user]);

  const setOfflineMode = useCallback((next: boolean): void => {
    offlineRef.current = next;
    setOffline(next);
  }, []);

  const setUnreachable = useCallback((next: boolean): void => {
    unreachableRef.current = next;
    setUnreachableState(next);
  }, []);

  const retryAfterBackoff = useCallback((): void => {
    retryStrikesRef.current += 1;
    setRetryAt({ at: Date.now() + backoffMs(retryStrikesRef.current) });
  }, []);

  const getAccessToken = useCallback((): string | null => accessTokenRef.current, []);

  // The token, the PIN unlock of this tab and the user go; the new key drops the writer's data
  const endSession = useCallback((): void => {
    sessionEpochRef.current += 1;
    accessTokenRef.current = null;
    setContentUnlockToken(null);
    forgetOfflineSession();
    setOfflineMode(false);
    setUnreachable(false);
    setUser(null);
    setSessionKey(sessionEpochRef.current);
  }, [setOfflineMode, setUnreachable]);

  // A sign-out the writer chose: this browser's draft copies go too, and so do the other tabs' sessions.
  // A draft is private text: it stays on the server for the next sign-in, not in this browser.
  const signOutLocally = useCallback((): void => {
    forgetLocalComposerDrafts();
    endSession();
    channelRef.current?.post({ type: 'signed-out' });
  }, [endSession]);

  const startSession = useCallback((session: TokenResponse): void => {
    // Another writer signs in over this one (a sign-up link opened while signed in): nothing of the first stays
    if (userIdRef.current !== null && userIdRef.current !== session.user.id) {
      endSession();
    }
    accessTokenRef.current = session.accessToken;
    clearSignOutPending();
    setUser(session.user);
    channelRef.current?.post({ type: 'signed-in', userId: session.user.id });
  }, [endSession]);

  useEffect(() => {
    const channel = openSessionChannel((message) => {
      // The cookie this tab refreshes with is gone, or now another writer's
      if (unreachableRef.current) {
        if (message.type === 'signed-out' || message.userId !== tokenUserId(accessTokenRef.current)) endSession();
        return;
      }
      const current = userIdRef.current;
      if (current !== null && (message.type === 'signed-out' || message.userId !== current)) {
        endSession();
      } else if (current === null && message.type === 'signed-out') {
        // No writer here yet: the session this tab may be restoring was just signed out, so it is not used
        sessionEpochRef.current += 1;
      }
    });
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [endSession]);

  // Exchange the refresh token cookie for a new access token (and a rotated cookie). Concurrent
  // callers share one request, since a refresh token works only once. A refresh the server refuses
  // (401, 403) ends the session it was for; one that answers after that session ended is not used.
  // Anything else leaves the session as it is: losing the connection, or the API asking to wait (429),
  // signs no one out. While a wait asked for runs, no tab sends a refresh (`refreshThrottle`).
  const refreshSession = useCallback((): Promise<RefreshOutcome> => {
    const epoch = sessionEpochRef.current;
    const throttled = (retryInMs: number): RefreshOutcome => {
      setRetryAt({ at: Date.now() + retryInMs });
      return { token: null, refused: false, retryInMs };
    };
    refreshInFlightRef.current ??= withRefreshLock(async (): Promise<RefreshOutcome> => {
      // Read under the lock: a tab whose turn comes after another one's 429 waits too
      const wait = refreshWaitMs();
      if (wait > 0) return throttled(wait);
      let response: Response;
      try {
        response = await fetch(`${API_BASE}/refresh`, {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch {
        return NO_ANSWER;
      }
      if (response.status === 429) return throttled(noteRefreshThrottled(response.headers.get('Retry-After')));
      clearRefreshThrottle();

      const current = epoch === sessionEpochRef.current;
      if (response.status === 401 || response.status === 403) {
        if (current && (accessTokenRef.current !== null || offlineRef.current || unreachableRef.current)) endSession();
        return { token: null, refused: true };
      }
      const data = response.ok ? await safeJsonParse<{ accessToken?: string }>(response) : null;
      if (!data?.accessToken || !current) return NO_ANSWER;
      accessTokenRef.current = data.accessToken;
      return { token: data.accessToken, refused: false };
    }).finally(() => {
      refreshInFlightRef.current = null;
    });
    return refreshInFlightRef.current;
  }, [endSession]);

  // A session left unconfirmed: the writer remembered here, if the token is theirs, keeps their journal
  // offline; otherwise the page says Thoughty cannot be reached. Either way the session is tried again later.
  const holdUnconfirmed = useCallback((token: string | null, owner: number | null): void => {
    const shown = userIdRef.current;
    // The writer shown offline is not the one this session is for: nothing of theirs stays
    if (shown !== null && shown !== owner) endSession();
    const remembered = shown === null ? readOfflineUser() : null;
    const known = owner !== null && (shown === owner || remembered?.id === owner);
    accessTokenRef.current = token;
    if (known && remembered) setUser(remembered);
    setOfflineMode(known);
    setUnreachable(!known);
  }, [endSession, setOfflineMode, setUnreachable]);

  // Who the session a token is for belongs to (`/me`). Only a `401` or `403` says the session is gone; a
  // token held since an earlier try may have expired, so it is refreshed once first. A `429`, a server
  // that is down or no answer keep the session, unconfirmed, and it is tried again later.
  const confirmSession = useCallback(async (token: string, epoch: number, justRefreshed: boolean): Promise<string | null> => {
    let answer: SessionUserAnswer = await readSessionUser(token);
    let held: string | null = token;
    if (answer.kind === 'refused' && !justRefreshed) {
      const refreshed = await refreshSession();
      held = refreshed.token;
      if (refreshed.token) answer = await readSessionUser(refreshed.token);
      else if (!refreshed.refused) answer = refreshed.retryInMs === undefined ? UNANSWERED : { kind: 'wait', retryInMs: refreshed.retryInMs };
    }
    // A session that ended meanwhile (signed out here or in another tab) is not brought back, nor its token kept
    if (epoch !== sessionEpochRef.current) {
      if (accessTokenRef.current === token || accessTokenRef.current === held) accessTokenRef.current = null;
      return null;
    }
    if (answer.kind === 'refused') {
      endSession();
      return null;
    }
    if (answer.kind === 'user') {
      retryStrikesRef.current = 0;
      setRetryAt(null);
      setOfflineMode(false);
      setUnreachable(false);
      startSession({ accessToken: held ?? token, user: answer.user });
      return held;
    }
    if (answer.kind === 'wait') setRetryAt({ at: Date.now() + answer.retryInMs });
    else retryAfterBackoff();
    holdUnconfirmed(held, tokenUserId(held ?? token));
    return held;
  }, [endSession, holdUnconfirmed, refreshSession, retryAfterBackoff, setOfflineMode, setUnreachable, startSession]);

  // A session left unconfirmed (opened offline, or `/me` unanswered) is confirmed once the API answers: the
  // token held since then, or else the refresh cookie, decides whether it goes on and `/me` says for whom;
  // a refusal ends it. Callers share one attempt.
  const reconnect = useCallback((): Promise<string | null> => {
    reconnectInFlightRef.current ??= (async () => {
      const epoch = sessionEpochRef.current;
      const held = accessTokenRef.current;
      if (held !== null) return confirmSession(held, epoch, false);
      const { token, refused, retryInMs } = await refreshSession();
      if (token && epoch === sessionEpochRef.current) return confirmSession(token, epoch, true);
      // No answer: tried again after a backoff, as well as before each request and when the connection returns
      if (!token && !refused && retryInMs === undefined) retryAfterBackoff();
      return null;
    })().finally(() => {
      reconnectInFlightRef.current = null;
    });
    return reconnectInFlightRef.current;
  }, [confirmSession, refreshSession, retryAfterBackoff]);

  // An unconfirmed session is tried again once the wait is over
  useEffect(() => {
    if ((!offline && !unreachable) || !retryAt) return undefined;
    const timer = setTimeout(() => void reconnect(), Math.max(0, retryAt.at - Date.now()));
    return () => clearTimeout(timer);
  }, [offline, unreachable, retryAt, reconnect]);

  // Fetch with auto token refresh
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Offline, each request first tries to get the session back, so what waited goes with a token
      if (offlineRef.current && accessTokenRef.current === null) await reconnect();
      const epoch = sessionEpochRef.current;
      const accessToken = getAccessToken();

      const makeRequest = async (token: string | null): Promise<Response> =>
        fetch(url, { ...options, headers: buildAuthHeaders(options, token) });

      let response = await makeRequest(accessToken);

      // An expired token is refreshed, for a request sent in a session that is still on
      if (response.status === 401 && accessToken !== null && epoch === sessionEpochRef.current) {
        const { token, retryInMs } = await refreshSession();
        if (token) {
          response = await makeRequest(token);
        } else if (retryInMs !== undefined && epoch === sessionEpochRef.current) {
          // Thoughty asked to wait before the next refresh: the writer stays signed in, unconfirmed, as
          // offline, and the expired token is not sent again; the session comes back once the wait is over
          accessTokenRef.current = null;
          setOfflineMode(true);
        }
      }

      return response;
    },
    [getAccessToken, reconnect, refreshSession, setOfflineMode]
  );

  // A connection coming back gets the session back at once, not only at the next request
  useEffect(() => {
    if (!offline && !unreachable) return undefined;
    const onOnline = () => void reconnect();
    globalThis.addEventListener('online', onOnline);
    return () => globalThis.removeEventListener('online', onOnline);
  }, [offline, unreachable, reconnect]);

  // Check if user is logged in on mount
  useEffect(() => {
    // Local accounts and Keycloak SSO live side by side: a visitor is never sent to Keycloak
    // unasked. The Keycloak session is exchanged only on the way back from "Continue with
    // Keycloak", which marks the attempt before leaving for the sign-in page.
    const restoreSsoSession = async () => {
      if (import.meta.env.PROD && hasPendingKeycloakSsoAttempt()) {
        clearKeycloakSsoAttempt();
        let sessionExchanged = false;
        await exchangeKeycloakSession((session) => {
          startSession(session);
          sessionExchanged = true;
        });
        if (!sessionExchanged) {
          markKeycloakSsoFailed();
        }
      }
      setLoading(false);
    };
    const checkAuth = async () => {
      removeLegacyStoredTokens();
      // A sign-out the server has not heard yet goes first: the cookie it revokes must not sign in
      if (isSignOutPending()) {
        await revokeRefreshCookie();
        setLoading(false);
        return;
      }
      const epoch = sessionEpochRef.current;
      const { token: accessToken, refused } = await refreshSession();
      if (!accessToken) {
        // Thoughty cannot be reached, or asks to wait (429): the writer last signed in here keeps their
        // journal, offline, unless another tab signed them out meanwhile. After a 429 the session is tried
        // again once the wait is over, so the journal opens at once rather than after a wait of minutes.
        const remembered = refused || epoch !== sessionEpochRef.current ? null : readOfflineUser();
        if (remembered) {
          setOfflineMode(true);
          setUser(remembered);
          setLoading(false);
          return;
        }
        if (refused) forgetOfflineSession();
        await restoreSsoSession();
        return;
      }

      // `/me` says whose the session is; only a `401` or `403` ends it, and nothing else forgets the writer
      await confirmSession(accessToken, epoch, true);
      setLoading(false);
    };

    checkAuth();
  }, [confirmSession, refreshSession, setOfflineMode, startSession]);

  // Logout ends the session here at once, then the server revokes the refresh token from its cookie
  // and clears the cookie. It waits for a refresh in flight, so it revokes the cookie that refresh set.
  const logout = useCallback(async (): Promise<void> => {
    const signedInWithKeycloak = user?.authProvider === 'keycloak';
    signOutLocally();
    await revokeRefreshCookie();
    // Only a Keycloak account also ends its Keycloak session; a local account just signs out here.
    if (import.meta.env.PROD && signedInWithKeycloak) {
      const returnUrl = `${window.location.origin}/`;
      window.location.assign(
        `https://keycloak.swirlit.dev/oauth2/sign_out?rd=${encodeURIComponent(returnUrl)}`,
      );
    }
  }, [signOutLocally, user]);

  return {
    user,
    setUser,
    loading,
    sessionKey,
    offline,
    unreachable,
    retrySession: reconnect,
    getAccessToken,
    startSession,
    signOutLocally,
    authFetch,
    logout,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildAuthHeaders, safeJsonParse } from '../services/api/base';
import { setContentUnlockToken } from '../services/api/contentUnlockToken';
import { API_BASE } from './authRequests';
import type { TokenResponse, User } from './authTypes';
import {
  clearKeycloakSsoAttempt,
  hasPendingKeycloakSsoAttempt,
  markKeycloakSsoFailed,
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
 * A refresh's outcome: a new access token, or none, and whether the API answered at all. A request that
 * never got an answer, or got one from a server that is down (5xx), says nothing about the session.
 */
interface RefreshOutcome {
  token: string | null;
  reached: boolean;
}

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
    const response = await fetch(`${API_BASE}/sso`);
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
   * confirmed the session, because it could not be reached when the app opened. It ends when the API
   * answers: the session goes on, or ends there if the server refuses it.
   */
  const [offline, setOffline] = useState(false);
  const offlineRef = useRef(false);

  // The access token lives in memory only; the refresh token is an httpOnly cookie the page
  // cannot read, so a reload gets a new access token through refreshAccessToken.
  const accessTokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<RefreshOutcome> | null>(null);
  /** Grows with each ended session, so a refresh or request that outlived it changes nothing. */
  const sessionEpochRef = useRef(0);
  const userIdRef = useRef<number | null>(null);
  const channelRef = useRef<SessionChannel | null>(null);
  const reconnectInFlightRef = useRef<Promise<string | null> | null>(null);

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

  const getAccessToken = useCallback((): string | null => accessTokenRef.current, []);

  // The token, the PIN unlock of this tab and the user go; the new key drops the writer's data
  const endSession = useCallback((): void => {
    sessionEpochRef.current += 1;
    accessTokenRef.current = null;
    setContentUnlockToken(null);
    forgetOfflineSession();
    setOfflineMode(false);
    setUser(null);
    setSessionKey(sessionEpochRef.current);
  }, [setOfflineMode]);

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
  // ends the session it was for; one that answers after that session ended is not used. One that
  // reaches no working API leaves the session as it is: losing the connection signs no one out.
  const refreshSession = useCallback((): Promise<RefreshOutcome> => {
    const epoch = sessionEpochRef.current;
    refreshInFlightRef.current ??= withRefreshLock(async (): Promise<RefreshOutcome> => {
      let response: Response;
      try {
        response = await fetch(`${API_BASE}/refresh`, {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch {
        return { token: null, reached: false };
      }
      if (response.status >= 500) return { token: null, reached: false };

      const data = response.ok ? await safeJsonParse<{ accessToken?: string }>(response) : null;
      const current = epoch === sessionEpochRef.current;
      if (!data?.accessToken) {
        if (current && (accessTokenRef.current !== null || offlineRef.current)) endSession();
        return { token: null, reached: true };
      }
      if (!current) return { token: null, reached: true };
      accessTokenRef.current = data.accessToken;
      return { token: data.accessToken, reached: true };
    }).finally(() => {
      refreshInFlightRef.current = null;
    });
    return refreshInFlightRef.current;
  }, [endSession]);

  const refreshAccessToken = useCallback(
    async (): Promise<string | null> => (await refreshSession()).token,
    [refreshSession],
  );

  // A journal opened offline gets its session back once the API answers: the refresh cookie decides
  // whether it goes on (and for whom: `/me` says), and a refusal ends it. Callers share one attempt.
  const reconnect = useCallback((): Promise<string | null> => {
    reconnectInFlightRef.current ??= (async () => {
      const epoch = sessionEpochRef.current;
      const { token } = await refreshSession();
      if (!token) return null;
      setOfflineMode(false);
      let me: User | null = null;
      try {
        const response = await fetch(`${API_BASE}/me`, { headers: buildAuthHeaders({}, token) });
        me = response.ok ? await safeJsonParse<User>(response) : null;
      } catch {
        // The token stands; `/me` is read again on the next load
      }
      // A session that ended while `/me` was read (signed out here or in another tab) is not brought back
      if (epoch !== sessionEpochRef.current) return null;
      if (me) startSession({ accessToken: token, user: me });
      return accessTokenRef.current;
    })().finally(() => {
      reconnectInFlightRef.current = null;
    });
    return reconnectInFlightRef.current;
  }, [refreshSession, setOfflineMode, startSession]);

  // Fetch with auto token refresh
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Offline, each request first tries to get the session back, so what waited goes with a token
      if (offlineRef.current && accessTokenRef.current === null) await reconnect();
      const epoch = sessionEpochRef.current;
      let accessToken = getAccessToken();

      const makeRequest = async (token: string | null): Promise<Response> =>
        fetch(url, { ...options, headers: buildAuthHeaders(options, token) });

      let response = await makeRequest(accessToken);

      // An expired token is refreshed, for a request sent in a session that is still on
      if (response.status === 401 && accessToken !== null && epoch === sessionEpochRef.current) {
        accessToken = await refreshAccessToken();
        if (accessToken) {
          response = await makeRequest(accessToken);
        }
      }

      return response;
    },
    [getAccessToken, reconnect, refreshAccessToken]
  );

  // A connection coming back gets the session back at once, not only at the next request
  useEffect(() => {
    if (!offline) return undefined;
    const onOnline = () => void reconnect();
    globalThis.addEventListener('online', onOnline);
    return () => globalThis.removeEventListener('online', onOnline);
  }, [offline, reconnect]);

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
      const { token: accessToken, reached } = await refreshSession();
      if (!accessToken) {
        // Thoughty cannot be reached: the writer last signed in here keeps their journal, offline,
        // unless another tab signed them out meanwhile
        const remembered = reached || epoch !== sessionEpochRef.current ? null : readOfflineUser();
        if (remembered) {
          setOfflineMode(true);
          setUser(remembered);
          setLoading(false);
          return;
        }
        if (reached) forgetOfflineSession();
        await restoreSsoSession();
        return;
      }

      try {
        const response = await authFetch(`${API_BASE}/me`);
        const userData = response.ok ? await safeJsonParse<User>(response) : null;
        if (epoch !== sessionEpochRef.current) {
          // Signed out in another tab meanwhile: the token is for a session that no longer exists
          accessTokenRef.current = null;
        } else if (userData) {
          setUser(userData);
        } else {
          endSession();
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        endSession();
      }
      setLoading(false);
    };

    checkAuth();
  }, [authFetch, endSession, refreshSession, setOfflineMode, startSession]);

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
    getAccessToken,
    startSession,
    signOutLocally,
    authFetch,
    logout,
  };
}

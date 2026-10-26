import { useCallback, useEffect, useRef, useState } from 'react';
import { safeJsonParse } from '../services/api/base';
import { API_BASE } from './authRequests';
import type { TokenResponse, User } from './authTypes';
import {
  clearKeycloakSsoAttempt,
  hasPendingKeycloakSsoAttempt,
  markKeycloakSsoFailed,
} from '../utils/keycloakSso';

/** Keys where older versions kept tokens in localStorage; they are removed on load. */
const LEGACY_TOKEN_KEYS = ['accessToken', 'refreshToken'] as const;
const REFRESH_LOCK_NAME = 'thoughty.auth-refresh';

/**
 * Removes tokens an older version left in localStorage, returning the refresh token so it can be
 * exchanged once for the httpOnly cookie and the session survives the upgrade.
 */
export function takeLegacyRefreshToken(): string | null {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    for (const key of LEGACY_TOKEN_KEYS) {
      localStorage.removeItem(key);
    }
    return refreshToken;
  } catch {
    return null;
  }
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
 * when a request gets a 401, and signs out.
 */
export function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // The access token lives in memory only; the refresh token is an httpOnly cookie the page
  // cannot read, so a reload gets a new access token through refreshAccessToken.
  const accessTokenRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  const getAccessToken = useCallback((): string | null => accessTokenRef.current, []);

  const startSession = useCallback((session: TokenResponse): void => {
    accessTokenRef.current = session.accessToken;
    setUser(session.user);
  }, []);

  const clearSession = useCallback((): void => {
    accessTokenRef.current = null;
  }, []);

  // Exchange the refresh token cookie for a new access token (and a rotated cookie). Concurrent
  // callers share one request, since a refresh token works only once.
  const refreshAccessToken = useCallback((legacyRefreshToken?: string | null): Promise<string | null> => {
    refreshInFlightRef.current ??= withRefreshLock(async () => {
      try {
        const response = await fetch(`${API_BASE}/refresh`, {
          method: 'POST',
          credentials: 'same-origin',
          ...(legacyRefreshToken
            ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: legacyRefreshToken }),
            }
            : {}),
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await safeJsonParse<{ accessToken?: string }>(response);
        if (!data?.accessToken) {
          throw new Error('Token refresh failed');
        }
        accessTokenRef.current = data.accessToken;
        return data.accessToken;
      } catch {
        accessTokenRef.current = null;
        setUser(null);
        return null;
      }
    }).finally(() => {
      refreshInFlightRef.current = null;
    });
    return refreshInFlightRef.current;
  }, []);

  // Fetch with auto token refresh
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      let accessToken = getAccessToken();

      const makeRequest = async (token: string | null): Promise<Response> => {
        const headers: HeadersInit = {
          ...options.headers,
          'Content-Type': 'application/json',
        };
        if (token) {
          (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }
        return fetch(url, { ...options, headers });
      };

      let response = await makeRequest(accessToken);

      // If token expired, try to refresh
      if (response.status === 401) {
        accessToken = await refreshAccessToken();
        if (accessToken) {
          response = await makeRequest(accessToken);
        }
      }

      return response;
    },
    [getAccessToken, refreshAccessToken]
  );

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
      const accessToken = await refreshAccessToken(takeLegacyRefreshToken());
      if (!accessToken) {
        await restoreSsoSession();
        return;
      }

      try {
        const response = await authFetch(`${API_BASE}/me`);
        if (response.ok) {
          const userData = await safeJsonParse<User>(response);
          if (userData) {
            setUser(userData);
          } else {
            clearSession();
          }
        } else {
          clearSession();
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        clearSession();
      }
      setLoading(false);
    };

    checkAuth();
  }, [authFetch, clearSession, refreshAccessToken, startSession]);

  // Logout: the server revokes the refresh token from its cookie and clears the cookie
  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    const signedInWithKeycloak = user?.authProvider === 'keycloak';
    clearSession();
    setUser(null);
    // Only a Keycloak account also ends its Keycloak session; a local account just signs out here.
    if (import.meta.env.PROD && signedInWithKeycloak) {
      const returnUrl = `${window.location.origin}/`;
      window.location.assign(
        `https://keycloak.swirlit.dev/oauth2/sign_out?rd=${encodeURIComponent(returnUrl)}`,
      );
    }
  }, [clearSession, user]);

  return {
    user,
    setUser,
    loading,
    getAccessToken,
    startSession,
    clearSession,
    authFetch,
    logout,
  };
}

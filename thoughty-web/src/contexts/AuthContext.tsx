/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { readApiErrorMessage, safeJsonParse } from '../services/api/base';
import {
  loginWithPassword,
  registerWithPassword,
  resendTwoFactorChallenge,
  verifyTwoFactorLogin,
} from './authRequests';
import type { AuthResult, TokenResponse, User } from './authTypes';
import {
  signInWithGoogleAccount,
} from './googleAuth';
import {
  clearKeycloakSsoAttempt,
  hasPendingKeycloakSsoAttempt,
  startKeycloakSso,
} from '../utils/keycloakSso';

export type { User } from './authTypes';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  register: (email: string, password: string, username: string, website?: string) => Promise<AuthResult>;
  login: (identifier: string, password: string, website?: string) => Promise<AuthResult>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<AuthResult>;
  resendTwoFactor: (challengeToken: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
  verifyEmail: (token: string) => Promise<AuthResult>;
  resendVerificationEmail: () => Promise<AuthResult>;
  deleteAccount: (password: string) => Promise<AuthResult>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  getAccessToken: () => string | null;
  googleClientId: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = '/api/auth';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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

export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const restoreSsoSession = async () => {
      if (import.meta.env.PROD) {
        let sessionExchanged = false;
        await exchangeKeycloakSession((session) => {
          startSession(session);
          sessionExchanged = true;
        });
        if (sessionExchanged) {
          clearKeycloakSsoAttempt();
        } else if (!hasPendingKeycloakSsoAttempt()) {
          startKeycloakSso();
          return;
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
          if (import.meta.env.PROD && !hasPendingKeycloakSsoAttempt()) {
            startKeycloakSso();
            return;
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        clearSession();
        if (import.meta.env.PROD && !hasPendingKeycloakSsoAttempt()) {
          startKeycloakSso();
          return;
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [authFetch, clearSession, refreshAccessToken, startSession]);

  // Register with email/password
  const register = useCallback(async (
    email: string,
    password: string,
    username: string,
    website = ''
  ): Promise<AuthResult> => {
    setError(null);
    try {
      const data = await registerWithPassword({ email, password, username, website });

      startSession(data);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [startSession]);

  // Login with email or username
  const login = useCallback(async (identifier: string, password: string, website = ''): Promise<AuthResult> => {
    setError(null);
    try {
      const data = await loginWithPassword({ identifier, password, website });

      if ('twoFactorRequired' in data) {
        return {
          success: true,
          twoFactorRequired: true,
          challengeToken: data.challengeToken,
          expiresInSeconds: data.expiresInSeconds,
        };
      }

      startSession(data);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [startSession]);

  const verifyTwoFactor = useCallback(async (
    challengeToken: string,
    code: string,
  ): Promise<AuthResult> => {
    setError(null);
    try {
      const data = await verifyTwoFactorLogin(challengeToken, code);
      startSession(data);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Two-factor verification failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [startSession]);

  const resendTwoFactor = useCallback(async (challengeToken: string): Promise<AuthResult> => {
    setError(null);
    try {
      const data = await resendTwoFactorChallenge(challengeToken);
      return {
        success: true,
        twoFactorRequired: true,
        challengeToken: data.challengeToken,
        expiresInSeconds: data.expiresInSeconds,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend verification code';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // Google login: the server verifies the raw Google ID token and reads the identity from it
  const googleCredentialLogin = useCallback(async (credential: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google', credential }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'OAuth login failed'));
      }

      const data = await safeJsonParse<TokenResponse>(response);

      if (!data) {
        throw new Error('Server unavailable');
      }

      startSession(data);
      return { success: true, isNewUser: data.user.isNewUser };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [startSession]);

  // Google Sign In
  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    return signInWithGoogleAccount(GOOGLE_CLIENT_ID, googleCredentialLogin);
  }, [googleCredentialLogin]);

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
    clearSession();
    setUser(null);
    if (import.meta.env.PROD) {
      sessionStorage.setItem('thoughty.keycloak-sso-attempt', 'pending');
      const returnUrl = `${window.location.origin}/`;
      window.location.assign(
        `https://keycloak.swirlit.dev/oauth2/sign_out?rd=${encodeURIComponent(returnUrl)}`,
      );
    }
  }, [clearSession]);

  // Change password
  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await authFetch(`${API_BASE}/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Password change failed'));
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password change failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [authFetch]);

  // Forgot password - request reset email
  const forgotPassword = useCallback(async (email: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Failed to send reset email'));
      }

      const data = await safeJsonParse<{ message?: string }>(response);

      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // Reset password with token
  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Failed to reset password'));
      }

      const data = await safeJsonParse<{ message?: string }>(response);

      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const verifyEmail = useCallback(async (token: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Email verification failed'));
      }

      const data = await safeJsonParse<{ message?: string }>(response);
      setUser((currentUser) => currentUser ? { ...currentUser, emailVerified: true } : null);
      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email verification failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const resendVerificationEmail = useCallback(async (): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await authFetch(`${API_BASE}/resend-verification-email`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Failed to resend verification email'));
      }

      const data = await safeJsonParse<{ message?: string }>(response);
      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend verification email';
      setError(message);
      return { success: false, error: message };
    }
  }, [authFetch]);

  // Delete account (flags for deletion)
  const deleteAccount = useCallback(async (password: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await authFetch(`${API_BASE}/delete-account`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Failed to delete account'));
      }

      const data = await safeJsonParse<{ message?: string }>(response);

      // Log the user out after account deletion; the server has cleared the cookie
      clearSession();
      setUser(null);
      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      setError(message);
      return { success: false, error: message };
    }
  }, [authFetch, clearSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register,
    login,
    verifyTwoFactor,
    resendTwoFactor,
    logout,
    signInWithGoogle,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    deleteAccount,
    authFetch,
    getAccessToken,
    googleClientId: GOOGLE_CLIENT_ID,
  }), [
    user,
    loading,
    error,
    register,
    login,
    verifyTwoFactor,
    resendTwoFactor,
    logout,
    signInWithGoogle,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    deleteAccount,
    authFetch,
    getAccessToken,
  ]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useState,
  useEffect,
  useCallback,
  useMemo,
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

export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get tokens from localStorage
  const getAccessToken = useCallback((): string | null => localStorage.getItem('accessToken'), []);
  const getRefreshToken = useCallback((): string | null => localStorage.getItem('refreshToken'), []);

  // Save tokens to localStorage
  const saveTokens = useCallback((accessToken: string, refreshToken: string): void => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }, []);

  // Clear tokens from localStorage
  const clearTokens = useCallback((): void => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  // Refresh access token
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      return data.accessToken;
    } catch {
      clearTokens();
      setUser(null);
      return null;
    }
  }, [clearTokens, getRefreshToken]);

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
    const checkAuth = async () => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await authFetch(`${API_BASE}/me`);
        if (response.ok) {
          const userData = await safeJsonParse<User>(response);
          if (userData) {
            setUser(userData);
          } else {
            clearTokens();
          }
        } else {
          clearTokens();
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        clearTokens();
      }
      setLoading(false);
    };

    checkAuth();
  }, [authFetch, clearTokens, getAccessToken]);

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

      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [saveTokens]);

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

      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [saveTokens]);

  const verifyTwoFactor = useCallback(async (
    challengeToken: string,
    code: string,
  ): Promise<AuthResult> => {
    setError(null);
    try {
      const data = await verifyTwoFactorLogin(challengeToken, code);
      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Two-factor verification failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [saveTokens]);

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

  // OAuth login (Google/Facebook)
  const oauthLogin = useCallback(async (
    provider: string,
    providerId: string,
    email: string,
    name: string,
    avatarUrl: string
  ): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, providerId, email, name, avatarUrl }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'OAuth login failed'));
      }

      const data = await safeJsonParse<TokenResponse>(response);

      if (!data) {
        throw new Error('Server unavailable');
      }

      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { success: true, isNewUser: data.user.isNewUser };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [saveTokens]);

  // Google Sign In
  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    return signInWithGoogleAccount(GOOGLE_CLIENT_ID, oauthLogin);
  }, [oauthLogin]);

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    clearTokens();
    setUser(null);
  }, [clearTokens, getRefreshToken]);

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

      // Log the user out after account deletion
      clearTokens();
      setUser(null);
      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      setError(message);
      return { success: false, error: message };
    }
  }, [authFetch, clearTokens]);

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

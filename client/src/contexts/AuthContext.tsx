import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// Google API Types
interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  prompt: (callback: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
  renderButton: (element: HTMLElement | null, config: { theme: string; size: string; width: string }) => void;
}

interface GoogleAccounts {
  id: GoogleAccountsId;
}

interface GoogleApi {
  accounts: GoogleAccounts;
}

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  fullName?: string;
  avatarUrl?: string;
  isNewUser?: boolean;
  authProvider?: 'local' | 'google';
}

interface AuthResult {
  success: boolean;
  error?: string;
  message?: string;
  isNewUser?: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  register: (email: string, password: string, username: string) => Promise<AuthResult>;
  login: (identifier: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
  deleteAccount: (password: string) => Promise<AuthResult>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  getAccessToken: () => string | null;
  googleClientId: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Google Sign-In types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
          }) => void) => void;
          renderButton: (
            element: HTMLElement | null,
            config: { theme: string; size: string; width: string }
          ) => void;
        };
      };
    };
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = '/api/auth';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Safe JSON parsing helper - returns null if parsing fails
const safeJsonParse = async <T = unknown>(response: Response): Promise<T | null> => {
  try {
    if (typeof response.json === 'function') {
      return await response.json();
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get tokens from localStorage
  const getAccessToken = (): string | null => localStorage.getItem('accessToken');
  const getRefreshToken = (): string | null => localStorage.getItem('refreshToken');

  // Save tokens to localStorage
  const saveTokens = (accessToken: string, refreshToken: string): void => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  };

  // Clear tokens from localStorage
  const clearTokens = (): void => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

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
    [refreshAccessToken]
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
  }, [authFetch]);

  // Register with email/password
  const register = async (
    email: string,
    password: string,
    username: string
  ): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      });

      const data = await safeJsonParse<TokenResponse & { error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Registration failed');
      }

      if (!data) {
        throw new Error('Server unavailable');
      }

      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  // Login with email or username
  const login = async (identifier: string, password: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await safeJsonParse<TokenResponse & { error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Login failed');
      }

      if (!data) {
        throw new Error('Server unavailable');
      }

      saveTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  // OAuth login (Google/Facebook)
  const oauthLogin = async (
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

      const data = await safeJsonParse<TokenResponse & { error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || 'OAuth login failed');
      }

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
  };

  // Google Sign In
  const signInWithGoogle = async (): Promise<AuthResult> => {
    return new Promise((resolve, reject) => {
      const google = (globalThis as unknown as { google?: GoogleApi }).google;
      if (!google || !GOOGLE_CLIENT_ID) {
        reject(new Error('Google Sign-In not configured'));
        return;
      }

      const handleGoogleCallback = (response: GoogleCredentialResponse): void => {
        const processCallback = async (): Promise<void> => {
          try {
            // Decode JWT to get user info
            const jwtParts = response.credential.split('.');
            const payloadPart = jwtParts[1];
            if (!payloadPart) {
              reject(new Error('Invalid JWT format'));
              return;
            }
            const payload = JSON.parse(atob(payloadPart));
            const result = await oauthLogin(
              'google',
              payload.sub,
              payload.email,
              payload.name,
              payload.picture
            );
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        void processCallback();
      };

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });

      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to popup
          google.accounts.id.renderButton(
            document.getElementById('google-signin-btn'),
            { theme: 'outline', size: 'large', width: '100%' }
          );
        }
      });
    });
  };

  // Logout
  const logout = async (): Promise<void> => {
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
  };

  // Change password
  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await authFetch(`${API_BASE}/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await safeJsonParse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Password change failed');
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password change failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  // Forgot password - request reset email
  const forgotPassword = async (email: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await safeJsonParse<{ message?: string; error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send reset email');
      }

      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(message);
      return { success: false, error: message };
    }
  };

  // Reset password with token
  const resetPassword = async (token: string, newPassword: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await safeJsonParse<{ message?: string; error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to reset password');
      }

      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
      return { success: false, error: message };
    }
  };

  // Delete account (flags for deletion)
  const deleteAccount = async (password: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await authFetch(`${API_BASE}/delete-account`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      const data = await safeJsonParse<{ message?: string; error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete account');
      }

      // Log the user out after account deletion
      clearTokens();
      setUser(null);
      return { success: true, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      setError(message);
      return { success: false, error: message };
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: !!user,
      register,
      login,
      logout,
      signInWithGoogle,
      changePassword,
      forgotPassword,
      resetPassword,
      deleteAccount,
      authFetch,
      getAccessToken,
      googleClientId: GOOGLE_CLIENT_ID,
    }),
    [user, loading, error, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

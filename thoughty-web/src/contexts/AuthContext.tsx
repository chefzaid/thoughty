/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type { AuthResult, User } from './authTypes';
import { useAccountActions } from './useAccountActions';
import { useAuthSession } from './useAuthSession';
import { useSignInActions } from './useSignInActions';

export type { User } from './authTypes';
export { exchangeKeycloakSession, takeLegacyRefreshToken } from './useAuthSession';

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

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  const [error, setError] = useState<string | null>(null);
  const {
    user,
    setUser,
    loading,
    getAccessToken,
    startSession,
    clearSession,
    authFetch,
    logout,
  } = useAuthSession();
  const {
    register,
    login,
    verifyTwoFactor,
    resendTwoFactor,
    signInWithGoogle,
  } = useSignInActions({ googleClientId: GOOGLE_CLIENT_ID, setError, startSession });
  const {
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    deleteAccount,
  } = useAccountActions({ authFetch, clearSession, setError, setUser });

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

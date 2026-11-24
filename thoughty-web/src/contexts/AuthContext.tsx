/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type { AuthResult, SignUpPreferences, User } from './authTypes';
import { useAccountActions } from './useAccountActions';
import { useAuthSession } from './useAuthSession';
import { useSignInActions } from './useSignInActions';

export type { User } from './authTypes';
export { exchangeKeycloakSession } from './useAuthSession';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  /** Moves on each time a session ends; what the app holds for a writer is keyed on it. */
  sessionKey: number;
  /** Set while the journal is open without the API having confirmed the session (Thoughty could not be reached). */
  offline: boolean;
  /** Set while the session goes on but Thoughty could not say whose it is, and no writer remembered here is theirs. */
  unreachable: boolean;
  /** Tries to confirm an unconfirmed session now (a wait the API asked for still holds). */
  retrySession: () => Promise<unknown>;
  /** `preferences`: the language and theme shown to the visitor, which the new account starts with. */
  register: (
    email: string,
    password: string,
    username: string,
    website?: string,
    preferences?: SignUpPreferences,
  ) => Promise<AuthResult>;
  completeSignUp: (token: string, password: string, username?: string) => Promise<AuthResult>;
  login: (identifier: string, password: string, website?: string) => Promise<AuthResult>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<AuthResult>;
  resendTwoFactor: (challengeToken: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  /** `preferences` apply when the Google sign-in creates the account. */
  signInWithGoogle: (preferences?: SignUpPreferences) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
  verifyEmail: (token: string) => Promise<AuthResult>;
  resendVerificationEmail: () => Promise<AuthResult>;
  /** Gives an address to an account that has none (`user.emailMissing`). */
  addEmail: (email: string) => Promise<AuthResult>;
  /** Reads the account's address again, as a link opened in another tab may have set it. */
  refreshAccountEmail: () => Promise<void>;
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
    sessionKey,
    offline,
    unreachable,
    retrySession,
    getAccessToken,
    startSession,
    signOutLocally,
    authFetch,
    logout,
  } = useAuthSession();
  const {
    register,
    completeSignUp,
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
    addEmail,
    refreshAccountEmail,
    deleteAccount,
  } = useAccountActions({ authFetch, signOutLocally, setError, setUser });

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    isAuthenticated: !!user,
    sessionKey,
    offline,
    unreachable,
    retrySession,
    register,
    completeSignUp,
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
    addEmail,
    refreshAccountEmail,
    deleteAccount,
    authFetch,
    getAccessToken,
    googleClientId: GOOGLE_CLIENT_ID,
  }), [
    user,
    loading,
    error,
    sessionKey,
    offline,
    unreachable,
    retrySession,
    register,
    completeSignUp,
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
    addEmail,
    refreshAccountEmail,
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

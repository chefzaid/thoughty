import { useCallback } from 'react';
import { readApiErrorMessage, safeJsonParse } from '../services/api/base';
import {
  API_BASE,
  authFailure,
  loginWithPassword,
  registerWithPassword,
  resendTwoFactorChallenge,
  verifyTwoFactorLogin,
} from './authRequests';
import type { AuthResult, TokenResponse } from './authTypes';
import { signInWithGoogleAccount } from './googleAuth';

interface SignInActionsOptions {
  googleClientId: string;
  setError: (message: string | null) => void;
  startSession: (session: TokenResponse) => void;
}

/** Ways to start a session: register, password login with optional two-factor step, and Google. */
export function useSignInActions({ googleClientId, setError, startSession }: SignInActionsOptions) {
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
      return authFailure(err, 'authFailed', setError);
    }
  }, [setError, startSession]);

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
      return authFailure(err, 'authFailed', setError);
    }
  }, [setError, startSession]);

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
      return authFailure(err, 'twoFactorVerificationFailed', setError);
    }
  }, [setError, startSession]);

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
      return authFailure(err, 'twoFactorResendFailed', setError);
    }
  }, [setError]);

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
        throw new Error(await readApiErrorMessage(response, 'googleSignInFailed'));
      }

      const data = await safeJsonParse<TokenResponse>(response);

      if (!data) {
        throw new Error('serverUnavailable');
      }

      startSession(data);
      return { success: true, isNewUser: data.user.isNewUser };
    } catch (err) {
      return authFailure(err, 'googleSignInFailed', setError);
    }
  }, [setError, startSession]);

  // Google Sign In
  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    return signInWithGoogleAccount(googleClientId, googleCredentialLogin);
  }, [googleClientId, googleCredentialLogin]);

  return { register, login, verifyTwoFactor, resendTwoFactor, signInWithGoogle };
}

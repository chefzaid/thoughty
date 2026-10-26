import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { readApiErrorMessage, safeJsonParse } from '../services/api/base';
import { API_BASE, authFailure } from './authRequests';
import type { AuthResult, User } from './authTypes';

interface AccountActionsOptions {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  clearSession: () => void;
  setError: (message: string | null) => void;
  setUser: Dispatch<SetStateAction<User | null>>;
}

/** Password, email verification and account deletion actions. */
export function useAccountActions({ authFetch, clearSession, setError, setUser }: AccountActionsOptions) {
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
        throw new Error(await readApiErrorMessage(response, 'passwordChangeFailed'));
      }

      return { success: true };
    } catch (err) {
      return authFailure(err, 'passwordChangeFailed', setError);
    }
  }, [authFetch, setError]);

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
        throw new Error(await readApiErrorMessage(response, 'forgotPasswordFailed'));
      }

      const data = await safeJsonParse<{ message?: string }>(response);
      return { success: true, message: data?.message };
    } catch (err) {
      return authFailure(err, 'forgotPasswordFailed', setError);
    }
  }, [setError]);

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
      return authFailure(err, 'Failed to reset password', setError);
    }
  }, [setError]);

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
      return authFailure(err, 'Email verification failed', setError);
    }
  }, [setError, setUser]);

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
      return authFailure(err, 'Failed to resend verification email', setError);
    }
  }, [authFetch, setError]);

  // Delete account (flags for deletion)
  const deleteAccount = useCallback(async (password: string): Promise<AuthResult> => {
    setError(null);
    try {
      const response = await authFetch(`${API_BASE}/delete-account`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'deleteAccountFailed'));
      }

      const data = await safeJsonParse<{ message?: string }>(response);

      // Log the user out after account deletion; the server has cleared the cookie
      clearSession();
      setUser(null);
      return { success: true, message: data?.message };
    } catch (err) {
      return authFailure(err, 'deleteAccountFailed', setError);
    }
  }, [authFetch, clearSession, setError, setUser]);

  return {
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    deleteAccount,
  };
}

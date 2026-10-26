import { readApiErrorMessage, safeJsonParse } from '../services/api/base';
import type { AuthResult, LoginResponse, TokenResponse, TwoFactorChallengeResponse } from './authTypes';

export const API_BASE = '/api/auth';

interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  website: string;
}

interface LoginRequest {
  identifier: string;
  password: string;
  website: string;
}

async function postAuthRequest<T>(path: string, payload: object, fallbackError: string): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallbackError));
  }

  const data = await safeJsonParse<T>(response);

  if (!data) {
    throw new Error('serverUnavailable');
  }

  return data;
}

export function registerWithPassword(payload: RegisterRequest): Promise<TokenResponse> {
  return postAuthRequest('register', payload, 'authFailed') as Promise<TokenResponse>;
}

export function loginWithPassword(payload: LoginRequest): Promise<LoginResponse> {
  return postAuthRequest('login', payload, 'authFailed') as Promise<LoginResponse>;
}

export function verifyTwoFactorLogin(challengeToken: string, code: string): Promise<TokenResponse> {
  return postAuthRequest(
    'two-factor/verify',
    { challengeToken, code },
    'twoFactorVerificationFailed',
  ) as Promise<TokenResponse>;
}

export function resendTwoFactorChallenge(challengeToken: string): Promise<TwoFactorChallengeResponse> {
  return postAuthRequest(
    'two-factor/resend',
    { challengeToken },
    'twoFactorResendFailed',
  ) as Promise<TwoFactorChallengeResponse>;
}

/** Records a failed auth call's message (or the fallback key) as the context error and returns it. */
export function authFailure(
  err: unknown,
  fallback: string,
  setError: (message: string) => void,
): AuthResult {
  const message = err instanceof Error ? err.message : fallback;
  setError(message);
  return { success: false, error: message };
}

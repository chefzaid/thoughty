import { readApiErrorMessage, safeJsonParse } from '../services/api/base';
import type { LoginResponse, TokenResponse, TwoFactorChallengeResponse } from './authTypes';

const API_BASE = '/api/auth';

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
    throw new Error('Server unavailable');
  }

  return data;
}

export function registerWithPassword(payload: RegisterRequest): Promise<TokenResponse> {
  return postAuthRequest('register', payload, 'Registration failed') as Promise<TokenResponse>;
}

export function loginWithPassword(payload: LoginRequest): Promise<LoginResponse> {
  return postAuthRequest('login', payload, 'Login failed') as Promise<LoginResponse>;
}

export function verifyTwoFactorLogin(challengeToken: string, code: string): Promise<TokenResponse> {
  return postAuthRequest(
    'two-factor/verify',
    { challengeToken, code },
    'Two-factor verification failed',
  ) as Promise<TokenResponse>;
}

export function resendTwoFactorChallenge(challengeToken: string): Promise<TwoFactorChallengeResponse> {
  return postAuthRequest(
    'two-factor/resend',
    { challengeToken },
    'Failed to resend verification code',
  ) as Promise<TwoFactorChallengeResponse>;
}

import { readApiErrorMessage, safeJsonParse, type AuthFetchFunction } from '../services/api/base';

export interface TwoFactorStatus {
  enabled: boolean;
  available: boolean;
  emailVerified: boolean;
}

interface TwoFactorChallenge {
  challengeToken: string;
}

async function parseResponse<T>(response: Response, fallbackError: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallbackError));
  }
  const data = await safeJsonParse<T>(response);
  if (!data) throw new Error(fallbackError);
  return data;
}

export async function getTwoFactorStatus(authFetch: AuthFetchFunction): Promise<TwoFactorStatus> {
  const response = await authFetch('/api/auth/two-factor/status');
  return parseResponse(response, 'Unable to load two-factor status');
}

export async function startTwoFactorSetup(authFetch: AuthFetchFunction): Promise<TwoFactorChallenge> {
  const response = await authFetch('/api/auth/two-factor/setup', { method: 'POST' });
  return parseResponse(response, 'Unable to start two-factor setup');
}

export async function enableTwoFactor(
  authFetch: AuthFetchFunction,
  challengeToken: string,
  code: string,
): Promise<{ success: boolean }> {
  const response = await authFetch('/api/auth/two-factor/enable', {
    method: 'POST',
    body: JSON.stringify({ challengeToken, code }),
  });
  return parseResponse(response, 'Unable to enable two-factor authentication');
}

export async function disableTwoFactor(
  authFetch: AuthFetchFunction,
  password: string,
): Promise<{ success: boolean }> {
  const response = await authFetch('/api/auth/two-factor/disable', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  return parseResponse(response, 'Unable to disable two-factor authentication');
}

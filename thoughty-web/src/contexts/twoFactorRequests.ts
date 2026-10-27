import type { components } from '../generated/openapi';
import { readApiErrorMessage, safeJsonParse, type AuthFetchFunction } from '../services/api/base';

export type TwoFactorStatus = components['schemas']['TwoFactorStatusResponseDto'];
type SuccessResponse = components['schemas']['SuccessResponseDto'];

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
  return parseResponse(response, 'twoFactorSetupFailed');
}

export async function enableTwoFactor(
  authFetch: AuthFetchFunction,
  challengeToken: string,
  code: string,
): Promise<SuccessResponse> {
  const response = await authFetch('/api/auth/two-factor/enable', {
    method: 'POST',
    body: JSON.stringify({ challengeToken, code }),
  });
  return parseResponse(response, 'twoFactorEnableFailed');
}

export async function disableTwoFactor(
  authFetch: AuthFetchFunction,
  password: string,
): Promise<SuccessResponse> {
  const response = await authFetch('/api/auth/two-factor/disable', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  return parseResponse(response, 'twoFactorDisableFailed');
}

import { readApiErrorMessage, safeJsonParse } from '../services/api/base';
import type { TokenResponse } from './authTypes';

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

async function postAuthRequest(path: string, payload: RegisterRequest | LoginRequest, fallbackError: string) {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallbackError));
  }

  const data = await safeJsonParse<TokenResponse>(response);

  if (!data) {
    throw new Error('Server unavailable');
  }

  return data;
}

export function registerWithPassword(payload: RegisterRequest): Promise<TokenResponse> {
  return postAuthRequest('register', payload, 'Registration failed');
}

export function loginWithPassword(payload: LoginRequest): Promise<TokenResponse> {
  return postAuthRequest('login', payload, 'Login failed');
}

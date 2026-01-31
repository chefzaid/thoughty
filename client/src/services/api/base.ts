// Base API utilities for making authenticated requests

export type AuthFetchFunction = (url: string, options?: RequestInit) => Promise<Response>;
export type GetAccessTokenFunction = () => string | null;

/**
 * Safe JSON parsing helper that handles various response types
 */
export const safeJsonParse = async <T = unknown>(response: Response | undefined | null): Promise<T | null> => {
  try {
    if (!response) return null;
    if (typeof response.json === 'function') {
      return await response.json() as T;
    }
    const text = await response.text();
    return text ? JSON.parse(text) as T : null;
  } catch {
    return null;
  }
};

/**
 * Creates an authenticated fetch helper using the provided auth functions
 */
export const createAuthFetch = (
  authFetch: AuthFetchFunction | undefined,
  getAccessToken: GetAccessTokenFunction | undefined
) => {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    if (typeof authFetch === 'function') {
      const maybeResponse = await authFetch(url, options);
      if (maybeResponse && typeof maybeResponse.ok === 'boolean') {
        return maybeResponse;
      }
    }

    const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };
};

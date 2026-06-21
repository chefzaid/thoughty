// Base API utilities for making authenticated requests

export type AuthFetchFunction = (url: string, options?: RequestInit) => Promise<Response>;
export type GetAccessTokenFunction = () => string | null;

interface ApiErrorPayload {
  error?: unknown;
  message?: unknown;
  details?: unknown;
}

const messageFromUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const messages = value
      .map(messageFromUnknown)
      .filter((message): message is string => Boolean(message));
    return messages.length > 0 ? messages.join(', ') : null;
  }

  if (value && typeof value === 'object') {
    const messages = Object.values(value)
      .map(messageFromUnknown)
      .filter((message): message is string => Boolean(message));
    return messages.length > 0 ? messages.join(', ') : null;
  }

  return null;
};

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

export const readApiErrorMessage = async (
  response: Response | undefined | null,
  fallback: string
): Promise<string> => {
  if (!response) {
    return fallback;
  }

  const jsonResponse = typeof response.clone === 'function' ? response.clone() : response;
  const payload = await safeJsonParse<ApiErrorPayload>(jsonResponse);
  const structuredMessage = messageFromUnknown(payload?.error)
    || messageFromUnknown(payload?.message)
    || messageFromUnknown(payload?.details);

  if (structuredMessage) {
    return structuredMessage;
  }

  try {
    const textResponse = typeof response.clone === 'function' ? response.clone() : response;
    const text = await textResponse.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
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
    const isFormData = options.body instanceof FormData;
    const headers: HeadersInit = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };
    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };
};

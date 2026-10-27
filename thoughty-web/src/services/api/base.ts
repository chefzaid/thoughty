// Base API utilities for making authenticated requests

import { apiErrorsTranslations, type ApiErrorTranslationKey } from '../../utils/translations.apiErrors';

export type AuthFetchFunction = (url: string, options?: RequestInit) => Promise<Response>;
export type GetAccessTokenFunction = () => string | null;

interface ApiErrorPayload {
  error?: unknown;
  message?: unknown;
  details?: unknown;
  code?: unknown;
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

/** The message of a parsed JSON error body: NestJS's `message` (a string or a list), then `error`, then `details`. */
const messageFromPayload = (payload: unknown): string | null => {
  if (typeof payload === 'string') {
    return messageFromUnknown(payload);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const { message, error, details } = payload as ApiErrorPayload;
  return messageFromUnknown(message) || messageFromUnknown(error) || messageFromUnknown(details);
};

/** The translation key for the API's error `code` (`apiError_<CODE>`), when the app knows that code. */
const codeKeyFromPayload = (payload: unknown): ApiErrorTranslationKey | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const { code } = payload as ApiErrorPayload;
  if (typeof code !== 'string') {
    return null;
  }
  const key = `apiError_${code}`;
  return Object.hasOwn(apiErrorsTranslations.en, key) ? (key as ApiErrorTranslationKey) : null;
};

const isJsonText = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/** A page from a proxy or server error handler rather than a message meant for the user. */
const isMarkup = (text: string, response: Response): boolean => {
  const contentType = response.headers?.get?.('content-type') ?? '';
  return /html|xml/i.test(contentType) || text.startsWith('<');
};

const readBodyText = async (response: Response): Promise<string> => {
  try {
    const textResponse = typeof response.clone === 'function' ? response.clone() : response;
    return typeof textResponse.text === 'function' ? (await textResponse.text()).trim() : '';
  } catch {
    return '';
  }
};

/**
 * What to show for a failed request, for the screen to translate with `t`: the translation key of the API's
 * error `code` (`apiError_<CODE>`, see docs/architecture.md), else the API's own message (which `t` passes
 * through unchanged), else `fallback`, a translation key. JSON bodies without a known code or a usable
 * message, empty bodies and HTML pages all give the fallback; only a plain-text body is shown as written.
 */
export const readApiErrorMessage = async (
  response: Response | undefined | null,
  fallback: string
): Promise<string> => {
  if (!response) {
    return fallback;
  }

  const jsonResponse = typeof response.clone === 'function' ? response.clone() : response;
  const payload = await safeJsonParse<unknown>(jsonResponse);
  if (payload !== null) {
    return codeKeyFromPayload(payload) || messageFromPayload(payload) || fallback;
  }

  const text = await readBodyText(response);
  if (!text || isMarkup(text, response) || isJsonText(text)) {
    return fallback;
  }
  return text;
};

/** The app sends JSON as text; any other body (FormData, Blob, ArrayBuffer, URLSearchParams, a stream) is not JSON. */
const isJsonBody = (body: RequestInit['body']): boolean => body === undefined || body === null || typeof body === 'string';

/**
 * The headers of an authenticated request: the caller's own, then `Content-Type: application/json` when the
 * caller set no content type and the body is JSON text (or there is none), then the bearer token. Other bodies
 * keep the type the browser gives them: a FormData its multipart boundary, a Blob its own type, URLSearchParams
 * a form encoding. A JSON type on a multipart body makes the API's JSON parser refuse it before the upload.
 */
export const buildAuthHeaders = (options: RequestInit, token: string | null): Record<string, string> => {
  const headers: Record<string, string> = options.headers instanceof Headers || Array.isArray(options.headers)
    ? Object.fromEntries(new Headers(options.headers).entries())
    : { ...options.headers };
  const hasContentType = Object.keys(headers).some((name) => name.toLowerCase() === 'content-type');
  if (!hasContentType && isJsonBody(options.body)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
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
    return fetch(url, { ...options, headers: buildAuthHeaders(options, token) });
  };
};

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

/** Resolves a JSON request to its data or a readable error, never throwing. */
export async function requestJson<T>(request: Promise<Response>, fallbackError: string): Promise<ServiceResult<T>> {
  try {
    const response = await request;
    if (!response.ok) {
      return { data: null, error: await readApiErrorMessage(response, fallbackError) };
    }

    const data = await safeJsonParse<T>(response);
    return data ? { data, error: null } : { data: null, error: fallbackError };
  } catch (error) {
    console.error(`${fallbackError}:`, error);
    return { data: null, error: fallbackError };
  }
}

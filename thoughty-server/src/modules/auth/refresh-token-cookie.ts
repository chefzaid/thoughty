import type { CookieOptions, Request, Response } from 'express';

/** The refresh token lives only in this httpOnly cookie, never in a response body. */
export const REFRESH_TOKEN_COOKIE = 'thoughty_refresh_token';
/** Only the auth endpoints (refresh, logout, session management) receive the cookie. */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/auth';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_TOKEN_COOKIE_PATH,
  };
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions(),
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

/** How the API docs describe a response that signs in. */
export const REFRESH_COOKIE_NOTE = `Sets the httpOnly \`${REFRESH_TOKEN_COOKIE}\` refresh token cookie (path /api/auth).`;

/** Moves a new session's refresh token into its cookie and returns the rest of the session. */
export function startSession<T extends { refreshToken: string }>(
  res: Response,
  session: T,
): Omit<T, 'refreshToken'> {
  const { refreshToken, ...response } = session;
  setRefreshTokenCookie(res, refreshToken);
  return response;
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions());
}

/** Reads the refresh token cookie from the raw `Cookie` header. */
export function readRefreshTokenCookie(req: Request): string | undefined {
  const header = req.headers?.cookie;
  if (!header) {
    return undefined;
  }
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1 || pair.slice(0, separator).trim() !== REFRESH_TOKEN_COOKIE) {
      continue;
    }
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim()) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

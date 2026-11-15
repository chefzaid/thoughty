import type { NextFunction, Request, Response } from 'express';

/** Where the routes a reader opens a private share link with live, under the API's `/api` prefix. */
export const SHARED_ROUTES_PATH = '/api/shared';

/**
 * Headers on every answer to a private share link, errors included: never cached (so a revoked link
 * stops at once), never indexed, no referrer sent on from it, and its files not embeddable by other sites.
 */
export const SHARED_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/**
 * Sets `SHARED_RESPONSE_HEADERS` as the request comes in, before anything can answer it: guards (the
 * rate limit's 429, a feature flag's 503), pipes, exception filters, the 404 of an unknown path, an
 * uncaught error, a file stream or a range. `configureApp` mounts it on `SHARED_ROUTES_PATH` after
 * helmet, whose own `Referrer-Policy` and `Cross-Origin-Resource-Policy` it replaces, and before CORS,
 * so a preflight carries them too. Nothing after it sets these four headers.
 */
export function sharedResponseHeaders(_req: Request, res: Response, next: NextFunction): void {
  for (const [name, value] of Object.entries(SHARED_RESPONSE_HEADERS)) {
    res.setHeader(name, value);
  }
  next();
}

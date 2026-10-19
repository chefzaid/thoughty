import { json, type RequestHandler } from 'express';

const BODY_LIMIT_PATTERN = /^\d+(?:\.\d+)?(?:b|kb|mb)$/i;

export const DEFAULT_JSON_BODY_LIMIT = '1mb';
export const DEFAULT_FORM_BODY_LIMIT = '256kb';
// Text imports accept files up to 5 MB, sent as a JSON string; escaping needs headroom.
export const DEFAULT_IMPORT_JSON_BODY_LIMIT = '8mb';
export const IMPORT_JSON_PATHS = ['/api/io/preview', '/api/io/import'];

export interface RequestPayloadLimits {
  json: string;
  urlencoded: string;
  importJson: string;
}

interface PayloadLimitEnv extends Record<string, string | undefined> {
  REQUEST_BODY_LIMIT?: string;
  REQUEST_JSON_BODY_LIMIT?: string;
  REQUEST_FORM_BODY_LIMIT?: string;
  REQUEST_IMPORT_BODY_LIMIT?: string;
}

function normalizeLimit(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  const compact = trimmed.replace(/\s+/g, '').toLowerCase();
  return BODY_LIMIT_PATTERN.test(compact) ? compact : fallback;
}

export function getRequestPayloadLimits(env: PayloadLimitEnv = process.env): RequestPayloadLimits {
  return {
    json: normalizeLimit(env.REQUEST_JSON_BODY_LIMIT ?? env.REQUEST_BODY_LIMIT, DEFAULT_JSON_BODY_LIMIT),
    urlencoded: normalizeLimit(env.REQUEST_FORM_BODY_LIMIT ?? env.REQUEST_BODY_LIMIT, DEFAULT_FORM_BODY_LIMIT),
    importJson: normalizeLimit(env.REQUEST_IMPORT_BODY_LIMIT, DEFAULT_IMPORT_JSON_BODY_LIMIT),
  };
}

interface MiddlewareHost {
  use(path: string[], handler: RequestHandler): unknown;
}

/** Mounted before the global JSON parser, which then skips the body already parsed here. */
export function useImportBodyParser(app: MiddlewareHost, limit: string): void {
  app.use(IMPORT_JSON_PATHS, json({ limit }));
}

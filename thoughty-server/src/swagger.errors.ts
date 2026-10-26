import { STATUS_CODES } from 'node:http';
import { genericApiErrorCode } from './common/errors/api-error-code.filter';

export const API_ERROR_SCHEMA_NAME = 'ApiErrorResponse';

interface ErrorResponseObject {
  description?: string;
  content?: Record<string, unknown>;
}

interface DocumentWithPaths {
  paths?: Record<string, unknown>;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

/**
 * Gives every documented 4xx/5xx response the `ApiErrorResponse` body (with its `code`), and an example
 * built from the response's own status and description.
 */
export function attachErrorResponseSchema<T extends DocumentWithPaths>(document: T): T {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method)) continue;
      const responses = (operation as { responses?: Record<string, ErrorResponseObject> }).responses ?? {};
      for (const [status, response] of Object.entries(responses)) {
        const statusCode = Number(status);
        if (statusCode >= 400 && !response.content) {
          response.content = { 'application/json': errorMediaType(statusCode, response.description) };
        }
      }
    }
  }
  return document;
}

function errorMediaType(statusCode: number, description: string | undefined) {
  return {
    schema: { $ref: `#/components/schemas/${API_ERROR_SCHEMA_NAME}` },
    example: {
      statusCode,
      message: description ?? STATUS_CODES[statusCode] ?? 'Error',
      error: STATUS_CODES[statusCode] ?? 'Error',
      code: genericApiErrorCode(statusCode),
    },
  };
}

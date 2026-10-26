import { HttpException } from '@nestjs/common';
import { API_ERROR_MESSAGES, type ApiErrorCode } from './api-error-codes';

/** The body of every error the API raises itself: Nest's usual shape plus a stable `code`. */
export interface ApiErrorBody {
  statusCode: number;
  /** English text for logs and API users; a list for validation errors. Clients translate by `code`. */
  message: string | string[];
  /** The HTTP reason phrase, e.g. "Bad Request". */
  error: string;
  code: ApiErrorCode;
}

type HttpExceptionClass<E extends HttpException> = new (objectOrError?: object) => E;

/**
 * An exception of Nest's class `Exception` (so its status and `instanceof` checks stay as they were) whose
 * body carries `code`, with the code's default English message unless a more specific one is given.
 *
 * @example throw apiError(UnauthorizedException, 'AUTH_INVALID_2FA_CODE');
 */
export function apiError<E extends HttpException>(
  Exception: HttpExceptionClass<E>,
  code: ApiErrorCode,
  message: string = API_ERROR_MESSAGES[code],
): E {
  // Without arguments, Nest's exception classes answer with their status and reason phrase.
  const { statusCode, message: error } = new Exception().getResponse() as { statusCode: number; message: string };
  const body: ApiErrorBody = { statusCode, message, error, code };
  return new Exception(body);
}

/** The `code` an error body carries, if any. */
export function apiErrorCodeOf(exception: HttpException): string | undefined {
  const response = exception.getResponse();
  if (typeof response !== 'object' || response === null) {
    return undefined;
  }
  const { code } = response as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

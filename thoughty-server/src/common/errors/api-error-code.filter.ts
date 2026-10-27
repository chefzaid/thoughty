import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { ApiErrorCode } from './api-error-codes';
import { apiErrorCodeOf } from './api-error';

const GENERIC_CODES: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/** The code for an error raised without one, from its status: other 4xx are invalid requests, other 5xx internal. */
export function genericApiErrorCode(status: number): ApiErrorCode {
  return GENERIC_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED');
}

/**
 * `exception` with a generic `code` added to its body when it was raised without one, and the
 * `statusCode` and `error` reason phrase every error body documents (`ApiErrorResponse`) when it
 * lacks them, as a guard's bare `UnauthorizedException()` or the throttler's message does. Nest's
 * other fields are kept.
 */
export function withApiErrorCode(exception: HttpException): HttpException {
  if (apiErrorCodeOf(exception)) {
    return exception;
  }
  const status = exception.getStatus();
  const response = exception.getResponse();
  const body = typeof response === 'string' ? { message: response } : response;
  return new HttpException(
    { statusCode: status, error: STATUS_CODES[status], ...body, code: genericApiErrorCode(status) },
    status,
    { cause: exception },
  );
}

/**
 * Gives every HTTP error a machine-readable `code`, so clients can translate it: errors raised with
 * `apiError` keep theirs, and the rest (validation pipe, guards, rate limits) get one from their status.
 */
@Catch(HttpException)
export class ApiErrorCodeFilter extends BaseExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    super.catch(withApiErrorCode(exception), host);
  }
}

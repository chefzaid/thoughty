import type { HttpException } from '@nestjs/common';
import type { ApiErrorCode } from './api-error-codes';
import { apiErrorCodeOf } from './api-error';

/** Expects `promise` to reject with an `Exception` whose body carries `code`. */
export async function expectApiError(
  promise: Promise<unknown>,
  Exception: abstract new (...args: never[]) => HttpException,
  code: ApiErrorCode,
): Promise<void> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(Exception);
  expect(apiErrorCodeOf(error as HttpException)).toBe(code);
}

import { BadRequestException, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { API_ERROR_CODES, type ApiErrorCode } from '../errors/api-error-codes';
import { apiError } from '../errors/api-error';

/**
 * The options of the API's global ValidationPipe (`main.ts`). HTTP and DTO specs build their pipe
 * from the same object so they see the same whitelisting as the running API. Values reach a DTO as
 * sent: implicit conversion stays off, since it would turn `{}` or `5` into a string, `''` into `0`
 * and `'false'` into `true`. `@StrictInt()` and `@StrictBoolean()` read numbers and booleans.
 */
export const GLOBAL_VALIDATION_PIPE_OPTIONS: Readonly<ValidationPipeOptions> = Object.freeze({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: false,
  },
});

/**
 * The error `code` a refusal names when every constraint it broke gives the same one in its
 * `context` (`@StrongPassword()` gives `AUTH_WEAK_PASSWORD`), so a client can say what to change.
 */
export function sharedConstraintCode(errors: readonly ValidationError[]): ApiErrorCode | undefined {
  const codes = new Set<unknown>();
  const collect = (error: ValidationError): void => {
    for (const constraint of Object.keys(error.constraints ?? {})) {
      codes.add((error.contexts?.[constraint] as { code?: unknown } | undefined)?.code);
    }
    error.children?.forEach(collect);
  };
  errors.forEach(collect);
  const [code] = codes;
  return codes.size === 1 && API_ERROR_CODES.includes(code as ApiErrorCode) ? (code as ApiErrorCode) : undefined;
}

/** Nest's pipe, whose refusal carries the code its constraints share (else `VALIDATION_FAILED`, given by status). */
class CodedValidationPipe extends ValidationPipe {
  override createExceptionFactory(): (errors: ValidationError[]) => unknown {
    const nestRefusal = super.createExceptionFactory();
    return (errors: ValidationError[] = []) => {
      const code = sharedConstraintCode(errors);
      return code ? apiError(BadRequestException, code) : nestRefusal(errors);
    };
  }
}

export function createGlobalValidationPipe(): ValidationPipe {
  return new CodedValidationPipe({ ...GLOBAL_VALIDATION_PIPE_OPTIONS });
}

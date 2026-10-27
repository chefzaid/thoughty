import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

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

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({ ...GLOBAL_VALIDATION_PIPE_OPTIONS });
}

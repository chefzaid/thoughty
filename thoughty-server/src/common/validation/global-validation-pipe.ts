import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * The options of the API's global ValidationPipe (`main.ts`). HTTP specs build their pipe from the
 * same object so they see the same conversion and whitelisting as the running API.
 */
export const GLOBAL_VALIDATION_PIPE_OPTIONS: Readonly<ValidationPipeOptions> = Object.freeze({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
});

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({ ...GLOBAL_VALIDATION_PIPE_OPTIONS });
}

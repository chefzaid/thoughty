import { applyDecorators } from '@nestjs/common';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsInt } from 'class-validator';

/**
 * Query strings and multipart form fields arrive as text, and the global ValidationPipe's
 * `enableImplicitConversion` turns that text into the property's declared type before any
 * `@Transform` runs: `Boolean('false')` is `true`, `Number('')` is `0`. These transforms read the
 * raw value instead (`obj[key]`), so only a value written exactly one of the accepted ways is taken
 * and anything else is left as it came, for the validator beside it to reject (400 VALIDATION_FAILED).
 */
const TRUE_VALUES: readonly unknown[] = [true, 'true', 1, '1'];
const FALSE_VALUES: readonly unknown[] = [false, 'false', 0, '0'];
const INTEGER_TEXT = /^-?\d+$/;

/** `true`/`false` (or `1`/`0`), as a value or as text; anything else stays as sent. */
export function parseStrictBoolean(raw: unknown): unknown {
  if (TRUE_VALUES.includes(raw)) return true;
  if (FALSE_VALUES.includes(raw)) return false;
  return raw;
}

/** A whole number, as a value or as plain digits with an optional minus; anything else stays as sent. */
export function parseStrictInt(raw: unknown): unknown {
  if (typeof raw === 'string' && INTEGER_TEXT.test(raw)) {
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : raw;
  }
  return raw;
}

/** The `@Transform` functions the decorators register; the DTO guard spec looks for these exact references. */
export const toStrictBoolean = ({ obj, key }: TransformFnParams): unknown => parseStrictBoolean(obj[key]);
export const toStrictInt = ({ obj, key }: TransformFnParams): unknown => parseStrictInt(obj[key]);

/**
 * A boolean input: accepts `true`, `false`, `1` and `0` (as JSON values or as text) and rejects
 * everything else. Every boolean DTO property uses it; add `@IsOptional()` when it may be left out.
 */
export function StrictBoolean(): PropertyDecorator {
  return applyDecorators(
    Transform(toStrictBoolean),
    IsBoolean({ message: '$property must be true, false, 1 or 0' }),
  );
}

/**
 * A whole-number input that may arrive as text (query strings, multipart form fields): accepts
 * integers and plain digit strings and rejects everything else, the empty string included.
 * Combine with `@Min`/`@Max` for ranges and `@IsOptional()` when it may be left out.
 */
export function StrictInt(): PropertyDecorator {
  return applyDecorators(
    Transform(toStrictInt),
    IsInt({ message: '$property must be a whole number' }),
  );
}

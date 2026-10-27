import { applyDecorators } from '@nestjs/common';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsInt } from 'class-validator';

/**
 * The global ValidationPipe converts nothing on its own (no implicit conversion: `Boolean('false')`
 * would be `true` and `Number('')` would be `0`), and query strings and multipart form fields arrive
 * as text. These transforms are the only place a boolean or a whole number is read: they take the
 * raw value (`obj[key]`), accept it only when written exactly one of the accepted ways (as a JSON
 * value or as text) and otherwise leave it as it came, for the validator beside it to reject
 * (400 VALIDATION_FAILED).
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
export const toStrictIntEach = ({ obj, key }: TransformFnParams): unknown => {
  const raw: unknown = obj[key];
  return Array.isArray(raw) ? raw.map(parseStrictInt) : raw;
};

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
 * A whole-number input, wherever it arrives (query string, multipart form field or JSON body):
 * accepts integers and plain digit strings and rejects everything else, the empty string, `1.5`
 * and `true` included. With `{ each: true }` it reads every item of an array the same way (the
 * array itself still needs `@IsArray()`). Combine with `@Min`/`@Max` for ranges (`{ each: true }`
 * for arrays) and `@IsOptional()` when it may be left out; `message` replaces the default one.
 * Every number DTO property uses it.
 */
export function StrictInt(options: { each?: boolean; message?: string } = {}): PropertyDecorator {
  const each = options.each === true;
  const message = options.message ?? (each ? 'each value in $property must be a whole number' : '$property must be a whole number');
  return applyDecorators(Transform(each ? toStrictIntEach : toStrictInt), IsInt({ each, message }));
}

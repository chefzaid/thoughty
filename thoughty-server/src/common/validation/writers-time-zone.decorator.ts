import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, ValidateBy } from 'class-validator';
import { isValidTimeZone } from '@/common/utils/time-zone.util';

/**
 * A named time zone: starts with a letter, so an offset such as `+05:30` (which PostgreSQL reads with
 * the POSIX sign, the other way round) never reaches SQL.
 */
const TIME_ZONE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_+\-/]*$/;

/**
 * The writer's IANA time zone (`Europe/Paris`), as the web reads it from the browser: a name that
 * `isValidTimeZone` recognizes, up to 64 characters. Anything else is refused (400 VALIDATION_FAILED).
 * Add `@IsOptional()` where it may be left out.
 */
export function WritersTimeZone(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MaxLength(64),
    Matches(TIME_ZONE_NAME_PATTERN),
    ValidateBy({
      name: 'isWritersTimeZone',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidTimeZone(value),
        defaultMessage: () => '$property must be an IANA time zone, such as Europe/Paris',
      },
    }),
  );
}

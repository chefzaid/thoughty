import { applyDecorators } from '@nestjs/common';
import { IsDateString, Matches, ValidateBy } from 'class-validator';
import { isWritersDay, LOCAL_DAY_PATTERN } from '@/common/utils/writers-day.util';

/**
 * The writer's own day (`YYYY-MM-DD`, from their clock), which "today", "this week", "this month" and
 * "this year" are measured by: a real day that is the UTC day or the one before or after it, since
 * every time zone is within a day of UTC. Anything else is refused (400 VALIDATION_FAILED). Add
 * `@IsOptional()` where it may be left out; the server then uses its UTC day (`writersDayOr`).
 */
export function WritersDay(): PropertyDecorator {
  return applyDecorators(
    Matches(LOCAL_DAY_PATTERN),
    IsDateString({ strict: true }),
    ValidateBy({
      name: 'isWritersDay',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isWritersDay(value, new Date()),
        defaultMessage: () => '$property must be the writer’s current day: the UTC day or the one before or after it',
      },
    }),
  );
}

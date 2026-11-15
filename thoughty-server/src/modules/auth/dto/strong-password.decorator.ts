import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { API_ERROR_MESSAGES, type ApiErrorCode } from '../../../common/errors/api-error-codes';

const WEAK_PASSWORD: ApiErrorCode = 'AUTH_WEAK_PASSWORD';

/**
 * The password rule for every password a writer chooses (sign-up, reset, change): at least 8
 * characters, with a lowercase and an uppercase letter, a digit and one of `!@#$%^&*(),.?":{}|<>`.
 * The web checks the same rule before sending (`isStrongPassword` in thoughty-web).
 */
export const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

export const STRONG_PASSWORD_DESCRIPTION =
  'At least 8 characters, with an uppercase and a lowercase letter, a number and one of ' +
  '`!@#$%^&*(),.?":{}|<>`; a string that breaks only this rule is refused with `AUTH_WEAK_PASSWORD`.';

/**
 * A text that follows the password rule. Breaking only the rule is refused with 400
 * `AUTH_WEAK_PASSWORD` (its constraint names the code, which the global validation pipe reads), so
 * a client can say what to change; a value that is not text stays a `VALIDATION_FAILED`.
 */
export function StrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Matches(STRONG_PASSWORD_PATTERN, {
      message: API_ERROR_MESSAGES[WEAK_PASSWORD],
      context: { code: WEAK_PASSWORD },
    }),
  );
}

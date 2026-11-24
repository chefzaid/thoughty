import { applyDecorators } from '@nestjs/common';
import { IsEmail, MaxLength, ValidateBy } from 'class-validator';
import { API_ERROR_MESSAGES, type ApiErrorCode } from '../../../common/errors/api-error-codes';
import { isPlaceholderEmail } from '../../../common/utils/placeholder-email.util';

const UNDELIVERABLE: ApiErrorCode = 'AUTH_EMAIL_UNDELIVERABLE';

export const DELIVERABLE_EMAIL_DESCRIPTION =
  'Up to 255 characters; an address on the reserved `.invalid` domain is refused with `AUTH_EMAIL_UNDELIVERABLE`.';

/**
 * An address a writer gives as their own (sign-up, replacing a placeholder): a valid address of up to
 * 255 characters, the column's size, that mail can reach. One on the reserved `.invalid` domain, where
 * placeholders live, is refused with 400 `AUTH_EMAIL_UNDELIVERABLE` (its constraint names the code, which
 * the global validation pipe reads); anything else that is not an address stays a `VALIDATION_FAILED`.
 */
export function DeliverableEmail(): PropertyDecorator {
  return applyDecorators(
    IsEmail({}, { message: 'Invalid email format' }),
    MaxLength(255),
    ValidateBy(
      {
        name: 'isDeliverableEmail',
        validator: { validate: (value: unknown) => typeof value !== 'string' || !isPlaceholderEmail(value) },
      },
      { message: API_ERROR_MESSAGES[UNDELIVERABLE], context: { code: UNDELIVERABLE } },
    ),
  );
}

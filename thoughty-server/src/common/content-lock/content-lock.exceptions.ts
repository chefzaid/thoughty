import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 423 Locked: the diary or entry is locked behind the writer's PIN and the request carries no unlock.
 * Raised with `apiError(ContentLockedException, 'CONTENT_LOCKED')`.
 */
export class ContentLockedException extends HttpException {
  constructor(objectOrError?: object) {
    super(objectOrError ?? { statusCode: HttpStatus.LOCKED, message: 'Locked' }, HttpStatus.LOCKED);
  }
}

/** 429: too many wrong PINs; no PIN is accepted until the lockout ends. */
export class TooManyPinAttemptsException extends HttpException {
  constructor(objectOrError?: object) {
    super(
      objectOrError ?? { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too Many Requests' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

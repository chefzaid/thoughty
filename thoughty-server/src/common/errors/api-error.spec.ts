import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { API_ERROR_CODES, API_ERROR_MESSAGES } from './api-error-codes';
import { apiError, apiErrorCodeOf } from './api-error';

describe('apiError', () => {
  it('keeps the Nest class, status and message, and adds the code to the body', () => {
    const error = apiError(UnauthorizedException, 'AUTH_INVALID_2FA_CODE');

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getStatus()).toBe(401);
    expect(error.message).toBe('Invalid or expired verification code.');
    expect(error.getResponse()).toEqual({
      statusCode: 401,
      message: 'Invalid or expired verification code.',
      error: 'Unauthorized',
      code: 'AUTH_INVALID_2FA_CODE',
    });
  });

  it('sends a more specific message under the same code', () => {
    const error = apiError(BadRequestException, 'ENTRY_PIN_LIMIT_REACHED', 'Pinned entry limit reached (5)');

    expect(error.getResponse()).toEqual({
      statusCode: 400,
      message: 'Pinned entry limit reached (5)',
      error: 'Bad Request',
      code: 'ENTRY_PIN_LIMIT_REACHED',
    });
  });

  it('reads the code of a body, and nothing from a body without one', () => {
    expect(apiErrorCodeOf(apiError(NotFoundException, 'ENTRY_NOT_FOUND'))).toBe('ENTRY_NOT_FOUND');
    expect(apiErrorCodeOf(new NotFoundException('Entry not found'))).toBeUndefined();
    expect(apiErrorCodeOf(new NotFoundException({ code: 7 }))).toBeUndefined();
  });
});

describe('API error codes', () => {
  it('are unique upper snake case names, each with an English message', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
    for (const code of API_ERROR_CODES) {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
      expect(API_ERROR_MESSAGES[code].trim()).not.toBe('');
    }
  });
});

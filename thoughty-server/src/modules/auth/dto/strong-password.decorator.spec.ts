import { BadRequestException, type Type } from '@nestjs/common';
import { parseLikeApi } from '../../../common/validation/dto-validation.test-helpers';
import { ChangePasswordDto, RegisterDto, ResetPasswordDto } from './auth.dto';

const refusalOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof BadRequestException ? error.getResponse() : Promise.reject(error)),
  );

describe('@StrongPassword()', () => {
  const cases: [string, Type<object>, (password: unknown) => object][] = [
    ['RegisterDto', RegisterDto, (password) => ({ email: 'writer@example.com', password })],
    ['ResetPasswordDto', ResetPasswordDto, (newPassword) => ({ token: 'link', newPassword })],
    ['ChangePasswordDto', ChangePasswordDto, (newPassword) => ({ currentPassword: 'Old1234!', newPassword })],
  ];

  describe.each(cases)('on %s', (_name, dto, body) => {
    it('takes a password with every kind of character', async () => {
      await expect(parseLikeApi(dto, body('Writer123!'))).resolves.toBeInstanceOf(dto);
    });

    it.each(['password123', 'PASSWORD123!', 'Password!!', 'Password123', 'Pass12!', 'Password123-_'])(
      'refuses %s with AUTH_WEAK_PASSWORD and the rule',
      async (password) => {
        await expect(refusalOf(parseLikeApi(dto, body(password)))).resolves.toEqual({
          statusCode: 400,
          error: 'Bad Request',
          code: 'AUTH_WEAK_PASSWORD',
          message: expect.stringContaining('at least 8 characters'),
        });
      },
    );

    it('leaves a password that is not text a plain validation failure', async () => {
      const refusal = await refusalOf(parseLikeApi(dto, body(12345678)));
      expect(refusal).not.toHaveProperty('code');
    });
  });

  it('leaves a weak password sent with another mistake a plain validation failure', async () => {
    const refusal = await refusalOf(parseLikeApi(RegisterDto, { email: 'not-an-email', password: 'password123' }));
    expect(refusal).toMatchObject({ message: expect.arrayContaining(['Invalid email format']) });
    expect(refusal).not.toHaveProperty('code');
  });
});

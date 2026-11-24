import { BadRequestException, type Type } from '@nestjs/common';
import { parseLikeApi } from '../../../common/validation/dto-validation.test-helpers';
import { AddEmailDto, RegisterDto } from './auth.dto';

const refusalOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof BadRequestException ? error.getResponse() : Promise.reject(error)),
  );

describe('@DeliverableEmail()', () => {
  const cases: [string, Type<object>, (email: unknown) => object][] = [
    ['RegisterDto', RegisterDto, (email) => ({ email, password: 'Writer123!' })],
    ['AddEmailDto', AddEmailDto, (email) => ({ email })],
  ];

  describe.each(cases)('on %s', (_name, dto, body) => {
    it('takes an address mail can reach', async () => {
      await expect(parseLikeApi(dto, body('writer@example.com'))).resolves.toBeInstanceOf(dto);
    });

    it('refuses an address on the reserved .invalid domain with AUTH_EMAIL_UNDELIVERABLE', async () => {
      await expect(refusalOf(parseLikeApi(dto, body('writer@mail.invalid')))).resolves.toMatchObject({
        statusCode: 400,
        code: 'AUTH_EMAIL_UNDELIVERABLE',
      });
    });

    it.each(['user-7@invalid', 'not an address', `${'a'.repeat(250)}@example.com`, 42])(
      'refuses %p as a plain validation failure',
      async (email) => {
        const refusal = await refusalOf(parseLikeApi(dto, body(email)));
        expect(refusal).toMatchObject({ statusCode: 400 });
        expect(refusal).not.toHaveProperty('code');
      },
    );
  });
});

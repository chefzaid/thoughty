import { BadRequestException } from '@nestjs/common';
import { IsString, ValidationError } from 'class-validator';
import { GLOBAL_VALIDATION_PIPE_OPTIONS, createGlobalValidationPipe, sharedConstraintCode } from './global-validation-pipe';

class NoteDto {
  @IsString()
  text!: string;
}

const pipe = createGlobalValidationPipe();
const parse = (body: unknown) => pipe.transform(body, { type: 'body', metatype: NoteDto });

describe('the global validation pipe', () => {
  it('whitelists DTO properties and converts nothing on its own', () => {
    expect(GLOBAL_VALIDATION_PIPE_OPTIONS).toMatchObject({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    });
  });

  it('hands the controller an instance of the DTO', async () => {
    await expect(parse({ text: 'A walk' })).resolves.toBeInstanceOf(NoteDto);
  });

  it.each([5, true, { body: 'A walk' }])('refuses %j for a string instead of turning it into text', async (text) => {
    await expect(parse({ text })).rejects.toThrow(BadRequestException);
  });

  it('refuses a property the DTO does not declare', async () => {
    await expect(parse({ text: 'A walk', userId: 3 })).rejects.toThrow(BadRequestException);
  });
});

describe('sharedConstraintCode', () => {
  const error = (constraints: Record<string, string>, contexts?: Record<string, unknown>, children: ValidationError[] = []) =>
    Object.assign(new ValidationError(), { property: 'field', constraints, contexts, children });

  it('names the code every broken constraint gives, nested ones included', () => {
    const weak = { code: 'AUTH_WEAK_PASSWORD' };
    expect(sharedConstraintCode([error({ matches: 'weak' }, { matches: weak })])).toBe('AUTH_WEAK_PASSWORD');
    expect(sharedConstraintCode([error({}, undefined, [error({ matches: 'weak' }, { matches: weak })])])).toBe('AUTH_WEAK_PASSWORD');
  });

  it('names none when a constraint gives no code, another one, or one the API does not have', () => {
    expect(sharedConstraintCode([])).toBeUndefined();
    expect(sharedConstraintCode([error({ isString: 'text' })])).toBeUndefined();
    expect(sharedConstraintCode([
      error({ matches: 'weak' }, { matches: { code: 'AUTH_WEAK_PASSWORD' } }),
      error({ isEmail: 'email' }),
    ])).toBeUndefined();
    expect(sharedConstraintCode([
      error({ matches: 'weak' }, { matches: { code: 'AUTH_WEAK_PASSWORD' } }),
      error({ matches: 'other' }, { matches: { code: 'AUTH_INVALID_PASSWORD' } }),
    ])).toBeUndefined();
    expect(sharedConstraintCode([error({ matches: 'x' }, { matches: { code: 'NOT_A_CODE' } })])).toBeUndefined();
  });
});

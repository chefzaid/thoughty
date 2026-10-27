import { plainToInstance } from 'class-transformer';
import { IsOptional, Min, validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { GLOBAL_VALIDATION_PIPE_OPTIONS, createGlobalValidationPipe } from './global-validation-pipe';
import { StrictBoolean, StrictInt, parseStrictBoolean, parseStrictInt } from './strict-input.decorators';

class FlagsDto {
  @IsOptional()
  @StrictBoolean()
  enabled?: boolean;

  @StrictBoolean()
  required!: boolean;
}

class CountsDto {
  @IsOptional()
  @StrictInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @StrictInt()
  offset?: number;
}

/** What the API's global pipe turns the raw input into, before validation. */
const convert = <T extends object>(cls: new () => T, plain: object): T =>
  plainToInstance(cls, plain, GLOBAL_VALIDATION_PIPE_OPTIONS.transformOptions);

const invalid = async (dto: object) => (await validate(dto)).map((error) => error.property);

describe('parseStrictBoolean', () => {
  it.each([true, 'true', 1, '1'])('reads %j as true', (raw) => expect(parseStrictBoolean(raw)).toBe(true));
  it.each([false, 'false', 0, '0'])('reads %j as false', (raw) => expect(parseStrictBoolean(raw)).toBe(false));
  it.each(['', 'yes', 'no', 'TRUE', 'False', ' true', 2, -1, ['true'], ['false'], {}, null, undefined])(
    'leaves %j as it came',
    (raw) => expect(parseStrictBoolean(raw)).toBe(raw),
  );
});

describe('parseStrictInt', () => {
  it.each([['0', 0], ['7', 7], ['-3', -3], ['007', 7], [42, 42], [0, 0]])('reads %j as %d', (raw, expected) =>
    expect(parseStrictInt(raw)).toBe(expected));
  it.each(['', ' ', '1.5', '1e3', '0x10', ' 5', '5 ', '12abc', '99999999999999999999', ['3'], 1.5, NaN, null, undefined, true])(
    'leaves %j as it came',
    (raw) => expect(parseStrictInt(raw)).toBe(raw),
  );
});

describe('StrictBoolean under the global pipe options', () => {
  it('keeps "false" false, where implicit conversion alone would make it true', async () => {
    const dto = convert(FlagsDto, { enabled: 'false', required: '0' });

    expect(dto).toEqual(expect.objectContaining({ enabled: false, required: false }));
    await expect(invalid(dto)).resolves.toEqual([]);
  });

  it('reads "true" and "1" as true', async () => {
    const dto = convert(FlagsDto, { enabled: 'true', required: '1' });

    expect(dto).toEqual(expect.objectContaining({ enabled: true, required: true }));
    await expect(invalid(dto)).resolves.toEqual([]);
  });

  it.each(['', 'yes', 'off', 'TRUE', ['true', 'false'], 2])('rejects %j', async (raw) => {
    await expect(invalid(convert(FlagsDto, { enabled: raw, required: true }))).resolves.toEqual(['enabled']);
  });

  it('lets an optional flag be left out, but not a required one', async () => {
    const dto = convert(FlagsDto, {});

    expect(dto.enabled).toBeUndefined();
    await expect(invalid(dto)).resolves.toEqual(['required']);
  });

  it('answers a refused flag with a message naming the accepted values', async () => {
    const error = await createGlobalValidationPipe()
      .transform({ enabled: 'yes', required: true }, { type: 'query', metatype: FlagsDto })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      message: ['enabled must be true, false, 1 or 0'],
    });
  });
});

describe('StrictInt under the global pipe options', () => {
  it('reads digit strings as whole numbers, "0" included', async () => {
    const dto = convert(CountsDto, { page: '3', offset: '0' });

    expect(dto).toEqual(expect.objectContaining({ page: 3, offset: 0 }));
    await expect(invalid(dto)).resolves.toEqual([]);
  });

  it('keeps the default when the value is left out', () => {
    expect(convert(CountsDto, {}).page).toBe(1);
  });

  it.each(['', '1.5', '2abc', '1e2', ['2', '3']])('rejects %j instead of reading it as a number', async (raw) => {
    await expect(invalid(convert(CountsDto, { offset: raw }))).resolves.toEqual(['offset']);
  });

  it('still applies the range beside it', async () => {
    await expect(invalid(convert(CountsDto, { page: '0' }))).resolves.toEqual(['page']);
  });

  it('answers a refused number with a message saying it must be whole', async () => {
    const error = await createGlobalValidationPipe()
      .transform({ offset: '' }, { type: 'query', metatype: CountsDto })
      .catch((caught: unknown) => caught);

    expect((error as BadRequestException).getResponse()).toMatchObject({ message: ['offset must be a whole number'] });
  });
});

import { BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { GLOBAL_VALIDATION_PIPE_OPTIONS, createGlobalValidationPipe } from './global-validation-pipe';

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

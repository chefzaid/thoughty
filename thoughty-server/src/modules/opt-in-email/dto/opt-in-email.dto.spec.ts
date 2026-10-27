import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmailUnsubscribeQueryDto, UpdateOptInEmailDto } from './opt-in-email.dto';

const errorsOf = async (dto: object) => (await validate(dto)).map((error) => error.property);

describe('opt-in email DTOs', () => {
  it('accept a whole hour of the day, a zone, and a diary or all of them', async () => {
    const valid = { enabled: true, deliveryHour: 23, timeZone: 'Europe/Paris', diaryId: null };
    expect(await errorsOf(plainToInstance(UpdateOptInEmailDto, valid))).toEqual([]);
    expect(await errorsOf(plainToInstance(UpdateOptInEmailDto, { ...valid, deliveryHour: -1, diaryId: 0 }))).toEqual(['deliveryHour', 'diaryId']);
  });

  it('take an unsubscribe token of at most 64 characters, long enough for the recap’s', async () => {
    expect(await errorsOf(plainToInstance(EmailUnsubscribeQueryDto, { token: `recap.4294967295.${'a'.repeat(43)}` }))).toEqual([]);
    expect(await errorsOf(plainToInstance(EmailUnsubscribeQueryDto, { token: 'x'.repeat(65) }))).toEqual(['token']);
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UnsubscribeOnThisDayEmailQueryDto, UpdateOnThisDayEmailDto } from './on-this-day-email.dto';

const errorsOf = async (dto: object) => (await validate(dto)).map((error) => error.property);

describe('On this day email DTOs', () => {
  it('accepts a whole hour of the day, a zone, and a diary or all of them', async () => {
    const valid = { enabled: true, deliveryHour: 0, timeZone: 'Europe/Paris', diaryId: null };
    expect(await errorsOf(plainToInstance(UpdateOnThisDayEmailDto, valid))).toEqual([]);
    expect(await errorsOf(plainToInstance(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: 23, diaryId: 4 }))).toEqual([]);
  });

  it('refuses hours outside the day, a missing switch, long zones, and bad diaries', async () => {
    const valid = { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: null };
    expect(await errorsOf(plainToInstance(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: 24 }))).toEqual(['deliveryHour']);
    expect(await errorsOf(plainToInstance(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: 7.5 }))).toEqual(['deliveryHour']);
    expect(await errorsOf(plainToInstance(UpdateOnThisDayEmailDto, { ...valid, enabled: 'yes' }))).toEqual(['enabled']);
    expect(await errorsOf(plainToInstance(UpdateOnThisDayEmailDto, { ...valid, timeZone: 'x'.repeat(65) }))).toEqual(['timeZone']);
    expect(await errorsOf(plainToInstance(UpdateOnThisDayEmailDto, { ...valid, diaryId: 0 }))).toEqual(['diaryId']);
    expect(await errorsOf(plainToInstance(UpdateOnThisDayEmailDto, { enabled: true, deliveryHour: 8, timeZone: 'UTC' }))).toEqual(['diaryId']);
  });

  it('takes the unsubscribe token as a short string', async () => {
    expect(await errorsOf(plainToInstance(UnsubscribeOnThisDayEmailQueryDto, { token: '3.abc' }))).toEqual([]);
    expect(await errorsOf(plainToInstance(UnsubscribeOnThisDayEmailQueryDto, { token: 'x'.repeat(65) }))).toEqual(['token']);
    expect(await errorsOf(plainToInstance(UnsubscribeOnThisDayEmailQueryDto, {}))).toEqual(['token']);
  });
});

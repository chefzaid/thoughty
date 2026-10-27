import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { UnsubscribeOnThisDayEmailQueryDto, UpdateOnThisDayEmailDto } from './on-this-day-email.dto';

describe('On this day email DTOs', () => {
  it('accepts a whole hour of the day, a zone, and a diary or all of them', async () => {
    const valid = { enabled: true, deliveryHour: 0, timeZone: 'Europe/Paris', diaryId: null };
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, valid)).toEqual([]);
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: 23, diaryId: 4 })).toEqual([]);
    await expect(parseLikeApi(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: '7', diaryId: '4' })).resolves.toMatchObject({ deliveryHour: 7, diaryId: 4 });
  });

  it('refuses hours outside the day, a missing switch, long zones, and bad diaries', async () => {
    const valid = { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: null };
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: 24 })).toEqual(['deliveryHour']);
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: 7.5 })).toEqual(['deliveryHour']);
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { ...valid, enabled: 'yes' })).toEqual(['enabled']);
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { ...valid, timeZone: 'x'.repeat(65) })).toEqual(['timeZone']);
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { ...valid, diaryId: 0 })).toEqual(['diaryId']);
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: '', diaryId: '' })).toEqual(['deliveryHour', 'diaryId']);
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { ...valid, deliveryHour: true, timeZone: 3 })).toEqual(['deliveryHour', 'timeZone']);
    expect(await invalidPropertiesLikeApi(UpdateOnThisDayEmailDto, { enabled: true, deliveryHour: 8, timeZone: 'UTC' })).toEqual(['diaryId']);
  });

  it('takes the unsubscribe token as a short string', async () => {
    expect(await invalidPropertiesLikeApi(UnsubscribeOnThisDayEmailQueryDto, { token: '3.abc' }, 'query')).toEqual([]);
    expect(await invalidPropertiesLikeApi(UnsubscribeOnThisDayEmailQueryDto, { token: 'x'.repeat(65) }, 'query')).toEqual(['token']);
    expect(await invalidPropertiesLikeApi(UnsubscribeOnThisDayEmailQueryDto, {}, 'query')).toEqual(['token']);
  });
});

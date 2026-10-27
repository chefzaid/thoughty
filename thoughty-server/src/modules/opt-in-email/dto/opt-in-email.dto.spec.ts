import { invalidPropertiesLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { EmailUnsubscribeQueryDto, UpdateOptInEmailDto } from './opt-in-email.dto';

describe('opt-in email DTOs', () => {
  it('accept a whole hour of the day, a zone, and a diary or all of them', async () => {
    const valid = { enabled: true, deliveryHour: 23, timeZone: 'Europe/Paris', diaryId: null };
    expect(await invalidPropertiesLikeApi(UpdateOptInEmailDto, valid)).toEqual([]);
    expect(await invalidPropertiesLikeApi(UpdateOptInEmailDto, { ...valid, deliveryHour: -1, diaryId: 0 })).toEqual(['deliveryHour', 'diaryId']);
  });

  it('take an unsubscribe token of at most 64 characters, long enough for the recap’s', async () => {
    expect(await invalidPropertiesLikeApi(EmailUnsubscribeQueryDto, { token: `recap.4294967295.${'a'.repeat(43)}` }, 'query')).toEqual([]);
    expect(await invalidPropertiesLikeApi(EmailUnsubscribeQueryDto, { token: 'x'.repeat(65) }, 'query')).toEqual(['token']);
  });
});

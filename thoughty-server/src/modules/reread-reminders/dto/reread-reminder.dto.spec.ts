import { invalidPropertiesLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { SetRereadReminderDto } from './reread-reminder.dto';

describe('SetRereadReminderDto', () => {
  // The writer's day must be within a day of UTC's, so the clock stays on 31 October
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-31T10:30:00Z'), doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('takes a reread day and the writer’s day as YYYY-MM-DD', async () => {
    await expect(invalidPropertiesLikeApi(SetRereadReminderDto, { rereadOn: '2026-11-07', today: '2026-10-31' })).resolves.toEqual([]);
  });

  it('refuses missing, impossible or differently written days, and anything else', async () => {
    await expect(invalidPropertiesLikeApi(SetRereadReminderDto, {})).resolves.toEqual(['rereadOn', 'today']);
    await expect(invalidPropertiesLikeApi(SetRereadReminderDto, { rereadOn: '2026-02-30', today: '2026-10-31' })).resolves.toEqual(['rereadOn']);
    await expect(
      invalidPropertiesLikeApi(SetRereadReminderDto, { rereadOn: '2026-11-07T00:00:00Z', today: 20261031 }),
    ).resolves.toEqual(['rereadOn', 'today']);
    await expect(
      invalidPropertiesLikeApi(SetRereadReminderDto, { rereadOn: '2026-11-07', today: '2026-10-31', userId: 2 }),
    ).resolves.toEqual(['userId']);
  });
});

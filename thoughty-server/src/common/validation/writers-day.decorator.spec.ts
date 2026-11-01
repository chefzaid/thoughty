import { IsOptional } from 'class-validator';
import { parseLikeApi } from './dto-validation.test-helpers';
import { WritersDay } from './writers-day.decorator';

class TodayQuery {
  @IsOptional()
  @WritersDay()
  today?: string;
}

describe('@WritersDay()', () => {
  afterEach(() => jest.useRealTimers());

  it('takes the day of the furthest time zones on either side of UTC, and none at all', async () => {
    // 10:30 UTC on 31 October: 00:30 on 1 November in Kiritimati, 23:30 on 30 October in Pago Pago
    jest.useFakeTimers({ now: new Date('2026-10-31T10:30:00Z'), doNotFake: ['nextTick', 'setImmediate'] });

    for (const today of ['2026-10-30', '2026-10-31', '2026-11-01']) {
      await expect(parseLikeApi(TodayQuery, { today }, 'query')).resolves.toEqual({ today });
    }
    await expect(parseLikeApi(TodayQuery, {}, 'query')).resolves.toEqual({});
  });

  it('refuses a day two days from UTC, an impossible day and another format', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-31T10:30:00Z'), doNotFake: ['nextTick', 'setImmediate'] });

    for (const today of ['2026-11-02', '2026-10-29', '2026-02-30', '31/10/2026', '2026-10-31T00:00:00Z']) {
      await expect(parseLikeApi(TodayQuery, { today }, 'query')).rejects.toThrow();
    }
  });
});

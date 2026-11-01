import { IsOptional } from 'class-validator';
import { parseLikeApi } from './dto-validation.test-helpers';
import { WritersTimeZone } from './writers-time-zone.decorator';

class TimeZoneQuery {
  @IsOptional()
  @WritersTimeZone()
  timeZone?: string;
}

describe('@WritersTimeZone()', () => {
  it('takes IANA time zones, the furthest from UTC included, and none at all', async () => {
    for (const timeZone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Europe/Paris', 'America/Argentina/Buenos_Aires', 'Etc/GMT+5', 'UTC']) {
      await expect(parseLikeApi(TimeZoneQuery, { timeZone }, 'query')).resolves.toEqual({ timeZone });
    }
    await expect(parseLikeApi(TimeZoneQuery, {}, 'query')).resolves.toEqual({});
  });

  it('refuses an unknown zone, an offset, a blank value and an overlong name', async () => {
    for (const timeZone of ['Mars/Olympus', '+05:30', '-11:00', '', 'Europe/Paris; DROP', `Europe/${'a'.repeat(64)}`]) {
      await expect(parseLikeApi(TimeZoneQuery, { timeZone }, 'query')).rejects.toThrow();
    }
  });
});

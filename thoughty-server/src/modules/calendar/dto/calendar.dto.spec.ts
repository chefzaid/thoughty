import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CALENDAR_DAYS_LIMIT, CalendarDaysQueryDto } from './calendar.dto';

const invalidProperties = (query: Record<string, unknown>) => invalidPropertiesLikeApi(CalendarDaysQueryDto, query, 'query');
const days = (count: number) => Array.from({ length: count }, (_, index) => `2026-01-${String((index % 28) + 1).padStart(2, '0')}`).join(',');

describe('CalendarDaysQueryDto', () => {
  it('reads comma-separated days with an optional time zone', async () => {
    await expect(parseLikeApi(CalendarDaysQueryDto, { dates: '2026-11-20,2026-11-22', timeZone: 'Europe/Paris' }, 'query'))
      .resolves.toMatchObject({ dates: ['2026-11-20', '2026-11-22'], timeZone: 'Europe/Paris' });
    await expect(invalidProperties({ dates: '2026-11-22' })).resolves.toEqual([]);
    await expect(invalidProperties({ dates: days(CALENDAR_DAYS_LIMIT) })).resolves.toEqual([]);
  });

  it('refuses no day, too many days, days that are not dates and a zone that is not one', async () => {
    await expect(invalidProperties({})).resolves.toEqual(['dates']);
    await expect(invalidProperties({ dates: days(CALENDAR_DAYS_LIMIT + 1) })).resolves.toEqual(['dates']);
    for (const dates of ['', '2026-11-22,', '2026-02-30', '2026-11-22,22/11/2026', '2026-11-22T10:00:00Z', "2026-11-22'; DROP"]) {
      await expect(invalidProperties({ dates })).resolves.toEqual(['dates']);
    }
    await expect(invalidProperties({ dates: '2026-11-22', timeZone: 'Mars/Olympus' })).resolves.toEqual(['timeZone']);
  });
});

import { StatsWritingTimesService } from './stats-writing-times.service';

function createService(rows: Array<{ hour: string | number; weekday: string | number; entries: string }>) {
  const query = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  const repository = { createQueryBuilder: jest.fn(() => query) };
  return { service: new StatsWritingTimesService(repository as never), query };
}

describe('StatsWritingTimesService', () => {
  it('adds up entries by hour from midnight and by weekday from Monday', async () => {
    const { service, query } = createService([
      { hour: '21', weekday: '2', entries: '3' },
      { hour: 21, weekday: 7, entries: '1' },
      { hour: '0', weekday: '1', entries: '2' },
      { hour: '23', weekday: '7', entries: '1' },
    ]);

    const times = await service.analyze(4, undefined, 'Pacific/Kiritimati');

    expect(times.hours).toHaveLength(24);
    expect(times.hours[21]).toBe(4);
    expect(times.hours[0]).toBe(2);
    expect(times.hours[23]).toBe(1);
    expect(times.hours.reduce((sum, count) => sum + count, 0)).toBe(7);
    expect(times.weekdays).toEqual([2, 3, 0, 0, 0, 0, 2]);
    expect(query.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(query.setParameter).toHaveBeenCalledWith('timeZone', 'Pacific/Kiritimati');
    expect(query.andWhere).not.toHaveBeenCalled();
  });

  it('reads one diary in UTC when no time zone is given, and empty lists for no entries', async () => {
    const { service, query } = createService([]);

    await expect(service.analyze(4, 9)).resolves.toEqual({
      hours: Array.from({ length: 24 }, () => 0),
      weekdays: [0, 0, 0, 0, 0, 0, 0],
    });
    expect(query.setParameter).toHaveBeenCalledWith('timeZone', 'UTC');
    expect(query.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 9 });
  });

  it('counts a typed time as it is and converts only the creation time', async () => {
    const { service, query } = createService([]);

    await service.analyze(4, undefined, 'Europe/Paris');

    const [hourSql] = query.select.mock.calls[0] as [string];
    const [weekdaySql] = query.addSelect.mock.calls[0] as [string];
    expect(hourSql).toContain('ELSE e.time_of_day END');
    expect(hourSql).toContain('e.created_at::timestamptz AT TIME ZONE :timeZone');
    expect(weekdaySql).toContain('EXTRACT(ISODOW FROM e.date)');
  });
});

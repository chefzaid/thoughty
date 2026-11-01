import { StatsRecordsService } from './stats-records.service';

type Row = Record<string, string | number> | undefined;

/** A service whose four record queries (longest, earliest, latest, first) answer `rows` in that order. */
function createService(rows: [Row, Row, Row, Row]) {
  const queries: Array<Record<string, jest.Mock>> = [];
  const repository = {
    createQueryBuilder: jest.fn(() => {
      const query: Record<string, jest.Mock> = {};
      for (const method of ['select', 'addSelect', 'where', 'andWhere', 'setParameter', 'orderBy', 'addOrderBy', 'limit']) {
        query[method] = jest.fn(() => query);
      }
      query.getRawOne = jest.fn().mockResolvedValue(rows[queries.length]);
      queries.push(query);
      return query;
    }),
  };
  return { service: new StatsRecordsService(repository as never), queries };
}

describe('StatsRecordsService', () => {
  it('reads each record’s entry and finds the busiest day and longest streak from the entries per day', async () => {
    const { service, queries } = createService([
      { id: '4', day: '2026-10-26', index: '1', words: '7' },
      { id: 5, day: '2026-10-27', index: 2, time: '06:45' },
      { id: 6, day: '2026-10-27', index: 1, time: '21:15' },
      { id: 7, day: '2026-09-01', index: 1 },
    ]);

    const records = await service.analyze(
      3,
      undefined,
      { '2026-10-31': 3, '2026-10-26': 1, '2026-10-27': 3, '2026-10-28': 1, '2026-09-01': 1 },
      'Pacific/Kiritimati',
    );

    expect(records).toEqual({
      longestEntry: { entryId: 4, date: '2026-10-26', index: 1, words: 7 },
      busiestDay: { date: '2026-10-27', entries: 3 },
      longestStreak: { days: 3, startDate: '2026-10-26', endDate: '2026-10-28' },
      earliestEntry: { entryId: 5, date: '2026-10-27', index: 2, time: '06:45' },
      latestEntry: { entryId: 6, date: '2026-10-27', index: 1, time: '21:15' },
      firstEntry: { entryId: 7, date: '2026-09-01', index: 1 },
    });
    for (const query of queries) {
      expect(query.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 3 });
      expect(query.andWhere).not.toHaveBeenCalledWith('e.diary_id = :diaryId', expect.anything());
      expect(query.addOrderBy).toHaveBeenCalledWith('e.timeOfDay', 'ASC', 'NULLS FIRST');
      expect(query.limit).toHaveBeenCalledWith(1);
    }
    const [longest, earliest, latest] = queries;
    expect(longest?.andWhere).toHaveBeenCalledWith(expect.stringContaining('> 0'));
    expect(longest?.orderBy).toHaveBeenCalledWith(expect.stringContaining('REGEXP_SPLIT_TO_ARRAY'), 'DESC');
    expect(earliest?.setParameter).toHaveBeenCalledWith('timeZone', 'Pacific/Kiritimati');
    expect(earliest?.orderBy).toHaveBeenCalledWith(expect.stringContaining('ELSE e.time_of_day END'), 'ASC');
    expect(latest?.orderBy).toHaveBeenCalledWith(expect.stringContaining('AT TIME ZONE :timeZone'), 'DESC');
  });

  it('keeps to one diary in UTC without a zone, and holds no records without entries', async () => {
    const { service, queries } = createService([undefined, undefined, undefined, undefined]);

    await expect(service.analyze(3, 9, {})).resolves.toEqual({
      longestEntry: null,
      busiestDay: null,
      longestStreak: null,
      earliestEntry: null,
      latestEntry: null,
      firstEntry: null,
    });
    for (const query of queries) {
      expect(query.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 9 });
    }
    expect(queries[1]?.setParameter).toHaveBeenCalledWith('timeZone', 'UTC');
  });
});

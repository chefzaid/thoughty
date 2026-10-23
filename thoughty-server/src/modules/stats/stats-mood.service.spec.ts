import { roundMood, StatsMoodService } from './stats-mood.service';

describe('StatsMoodService', () => {
  const createQueryBuilder = (rows: unknown[]) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  it('sums up recorded moods by month, weekday, and level, and the feelings used most', async () => {
    const monthQb = createQueryBuilder([
      { month: '2025-01', average: '3.6666', entries: '3' },
      { month: '2025-02', average: '2.0000', entries: '1' },
    ]);
    const weekdayQb = createQueryBuilder([
      { weekday: 1, average: '4.5', entries: '2' },
      { weekday: '7', average: '2', entries: '2' },
    ]);
    const levelQb = createQueryBuilder([
      { level: 2, entries: '2' },
      { level: '5', entries: '2' },
    ]);
    const feelingQb = createQueryBuilder([{ feeling: 'calm', count: '3' }, { feeling: 'tired', count: '1' }]);
    const repository = {
      createQueryBuilder: jest.fn()
        .mockReturnValueOnce(monthQb)
        .mockReturnValueOnce(weekdayQb)
        .mockReturnValueOnce(levelQb)
        .mockReturnValueOnce(feelingQb),
    };

    const moods = await new StatsMoodService(repository as never).analyze(7, 3);

    expect(moods).toEqual({
      recordedEntries: 4,
      averageMood: 3.5,
      levels: [0, 2, 0, 0, 2],
      months: [
        { month: '2025-01', average: 3.7, entries: 3 },
        { month: '2025-02', average: 2, entries: 1 },
      ],
      weekdays: [
        { average: 4.5, entries: 2 },
        { average: null, entries: 0 },
        { average: null, entries: 0 },
        { average: null, entries: 0 },
        { average: null, entries: 0 },
        { average: null, entries: 0 },
        { average: 2, entries: 2 },
      ],
      topFeelings: [{ feeling: 'calm', count: 3 }, { feeling: 'tired', count: 1 }],
    });
    for (const qb of [monthQb, weekdayQb, levelQb]) {
      expect(qb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
      expect(qb.andWhere).toHaveBeenCalledWith('e.mood IS NOT NULL');
      expect(qb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    }
    expect(feelingQb.andWhere).toHaveBeenCalledWith('CARDINALITY(e.feelings) > 0');
    expect(feelingQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    expect(feelingQb.limit).toHaveBeenCalledWith(10);
    expect(weekdayQb.select).toHaveBeenCalledWith('EXTRACT(ISODOW FROM e.date)::int', 'weekday');
  });

  it('reports no average when no mood was recorded, across all diaries', async () => {
    const qbs = [createQueryBuilder([]), createQueryBuilder([]), createQueryBuilder([]), createQueryBuilder([])];
    const repository = { createQueryBuilder: jest.fn(() => qbs.shift()) };

    const moods = await new StatsMoodService(repository as never).analyze(7);

    expect(moods).toMatchObject({ recordedEntries: 0, averageMood: null, levels: [0, 0, 0, 0, 0], months: [], topFeelings: [] });
    expect(moods.weekdays).toHaveLength(7);
  });

  it('rounds averages to one decimal', () => {
    expect(roundMood('3.25')).toBe(3.3);
    expect(roundMood(4)).toBe(4);
    expect(roundMood(null)).toBeNull();
    expect(roundMood('x')).toBeNull();
  });
});

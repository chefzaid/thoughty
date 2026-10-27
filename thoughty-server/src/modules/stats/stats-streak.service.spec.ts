import { StatsStreakService } from './stats-streak.service';

describe('StatsStreakService', () => {
  const builders: Array<Record<string, jest.Mock>> = [];
  const makeBuilder = () => {
    const builder: Record<string, jest.Mock> = {};
    for (const method of ['where', 'andWhere', 'select', 'addSelect', 'setParameter', 'groupBy', 'orderBy', 'addOrderBy', 'limit']) {
      builder[method] = jest.fn().mockReturnValue(builder);
    }
    builder.getRawMany = jest.fn();
    builder.getRawAndEntities = jest.fn();
    builders.push(builder);
    return builder;
  };
  const entryRepository = { createQueryBuilder: jest.fn(makeBuilder) };
  const service = new StatsStreakService(entryRepository as never);

  const answer = (days: string[], last: { id: number; date: string; title: string | null; content: string | null } | null) => {
    entryRepository.createQueryBuilder
      .mockImplementationOnce(() => {
        const builder = makeBuilder();
        builder.getRawMany.mockResolvedValue(days.map((day) => ({ day })));
        return builder;
      })
      .mockImplementationOnce(() => {
        const builder = makeBuilder();
        builder.getRawAndEntities.mockResolvedValue(last
          ? { entities: [{ id: last.id, date: last.date, title: last.title }], raw: [{ content_start: last.content }] }
          : { entities: [], raw: [] });
        return builder;
      });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    builders.length = 0;
  });

  it('counts the days in a row up to today and summarises the last entry', async () => {
    answer(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-20'], {
      id: 9, date: '2026-10-27', title: 'Evening', content: '# Heading\n\nA **quiet** day by the sea.',
    });

    await expect(service.getStreak(7, 3, '2026-10-27')).resolves.toEqual({
      currentStreak: 3,
      writtenToday: true,
      daysSinceLastEntry: 0,
      lastEntry: { id: 9, date: '2026-10-27', title: 'Evening', snippet: 'Heading A quiet day by the sea.' },
    });
    for (const builder of builders) {
      expect(builder.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
      expect(builder.andWhere).toHaveBeenCalledWith('e.date <= :today', { today: '2026-10-27' });
      expect(builder.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    }
    expect(builders[1]!.orderBy).toHaveBeenCalledWith('e.date', 'DESC');
    expect(builders[1]!.limit).toHaveBeenCalledWith(1);
  });

  it('keeps yesterday’s streak while today has no entry yet', async () => {
    answer(['2026-10-25', '2026-10-26'], { id: 4, date: '2026-10-26', title: null, content: null });

    await expect(service.getStreak(7, undefined, '2026-10-27')).resolves.toEqual({
      currentStreak: 2,
      writtenToday: false,
      daysSinceLastEntry: 1,
      lastEntry: { id: 4, date: '2026-10-26', title: null, snippet: '' },
    });
    expect(builders[0]!.andWhere).not.toHaveBeenCalledWith('e.diary_id = :diaryId', expect.anything());
  });

  it('measures the gap since the last entry, with no streak after it', async () => {
    answer(['2026-10-01', '2026-10-02'], { id: 2, date: '2026-10-02', title: null, content: 'Before the trip' });

    await expect(service.getStreak(7, undefined, '2026-10-27')).resolves.toEqual(
      expect.objectContaining({ currentStreak: 0, writtenToday: false, daysSinceLastEntry: 25 }),
    );
  });

  it('answers an empty journal with no streak and no last entry', async () => {
    answer([], null);

    await expect(service.getStreak(7, undefined, '2026-10-27')).resolves.toEqual({
      currentStreak: 0,
      writtenToday: false,
      daysSinceLastEntry: null,
      lastEntry: null,
    });
  });
});

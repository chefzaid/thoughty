import { IsNull, Not } from 'typeorm';
import { StatsGoalService } from './stats-goal.service';

describe('StatsGoalService', () => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const diaryRepository = { find: jest.fn() };
  const entryRepository = { createQueryBuilder: jest.fn(() => queryBuilder) };
  const service = new StatsGoalService(diaryRepository as never, entryRepository as never);

  beforeEach(() => jest.clearAllMocks());

  it('measures nothing when no diary in scope has a goal', async () => {
    diaryRepository.find.mockResolvedValue([]);

    await expect(service.analyze(7, 3, '2026-10-27')).resolves.toEqual([]);
    expect(diaryRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 7, goalType: Not(IsNull()), id: 3 },
    }));
    expect(entryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('measures every diary’s goal from the writer’s entries up to their day', async () => {
    diaryRepository.find.mockResolvedValue([
      { id: 1, name: 'Morning pages', icon: '☀️', goalType: 'words_per_day', goalTarget: 50 },
      { id: 2, name: 'Work', icon: '💼', goalType: 'entries_per_week', goalTarget: 2 },
      { id: 4, name: 'Broken', icon: '📓', goalType: 'entries_per_week', goalTarget: null },
    ]);
    queryBuilder.getRawMany.mockResolvedValue([
      { diaryId: '1', day: '2026-10-26', entries: '1', words: '80' },
      { diaryId: 1, day: '2026-10-27', entries: 2, words: 20 },
      { diaryId: '2', day: '2026-10-26', entries: '2', words: '10' },
    ]);

    const goals = await service.analyze(7, undefined, '2026-10-27');

    expect(diaryRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7, goalType: Not(IsNull()) } }));
    expect(queryBuilder.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('e.diary_id IN (:...diaryIds)', { diaryIds: [1, 2, 4] });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('e.date <= :today', { today: '2026-10-27' });
    expect(goals).toEqual([
      expect.objectContaining({
        diaryId: 1, diaryName: 'Morning pages', diaryIcon: '☀️', goalType: 'words_per_day', goalTarget: 50,
        period: 'day', progress: 20, met: false, currentStreak: 1, metPeriods: ['2026-10-26'],
      }),
      expect.objectContaining({
        diaryId: 2, goalType: 'entries_per_week', period: 'week', periodStart: '2026-10-26', progress: 2, met: true, currentStreak: 1,
      }),
    ]);
  });
});

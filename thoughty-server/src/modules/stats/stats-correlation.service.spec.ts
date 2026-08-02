import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Entry } from '@/database/entities';
import { StatsCorrelationService } from './stats-correlation.service';

describe('StatsCorrelationService', () => {
  let service: StatsCorrelationService;
  let queryBuilder: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsCorrelationService,
        {
          provide: getRepositoryToken(Entry),
          useValue: { createQueryBuilder: jest.fn(() => queryBuilder) },
        },
      ],
    }).compile();

    service = module.get(StatsCorrelationService);
  });

  it('finds the strongest entry and tag relationships deterministically', async () => {
    queryBuilder.getMany.mockResolvedValue([
      { id: 1, date: '2025-01-01', index: 1, tags: ['focus', 'work', 'work', ' '] },
      { id: 2, date: '2025-02-01', index: 1, tags: ['work'] },
      { id: 3, date: '2025-03-01', index: 1, tags: ['health', 'focus', 'work'] },
      { id: 4, date: '2025-04-01', index: 1, tags: ['personal', 'health'] },
    ]);

    const result = await service.analyze(7);

    expect(result.analyzedEntries).toBe(4);
    expect(result.entryConnections[0]).toEqual({
      sourceEntryId: 3,
      sourceDate: '2025-03-01',
      sourceIndex: 1,
      targetEntryId: 1,
      targetDate: '2025-01-01',
      targetIndex: 1,
      sharedTags: ['focus', 'work'],
      score: 82,
    });
    expect(result.tagConnections[0]).toEqual({
      firstTag: 'focus',
      secondTag: 'work',
      sharedEntries: 2,
      strength: 82,
    });
  });

  it('scopes the analysis to a diary', async () => {
    await service.analyze(7, 3);

    expect(queryBuilder.where).toHaveBeenCalledWith('entry.user_id = :userId', { userId: 7 });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('entry.diary_id = :diaryId', {
      diaryId: 3,
    });
  });

  it('returns empty correlations for an empty journal', async () => {
    await expect(service.analyze(7)).resolves.toEqual({
      analyzedEntries: 0,
      entryConnections: [],
      tagConnections: [],
    });
  });

  it('bounds entry and tag connections', async () => {
    queryBuilder.getMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        date: `2025-01-${String(index + 1).padStart(2, '0')}`,
        index: 1,
        tags: ['common', `tag-${index}`],
      })),
    );

    const result = await service.analyze(7);

    expect(result.entryConnections).toHaveLength(12);
    expect(result.tagConnections).toHaveLength(12);
  });
});

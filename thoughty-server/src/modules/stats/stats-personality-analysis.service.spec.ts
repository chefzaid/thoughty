import { BadRequestException } from '@nestjs/common';
import { StatsPersonalityAnalysisService } from './stats-personality-analysis.service';

function makeEntry(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    content: `Planning learning reflection ${id}`,
    tags: ['work'],
    date: `2024-01-${String((id % 28) + 1).padStart(2, '0')}`,
    ...overrides,
  };
}

function createQueryBuilder(entries: unknown[]) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(entries),
  };
}

describe('StatsPersonalityAnalysisService', () => {
  it('pages through every matching entry and sends only bounded aggregates to AI', async () => {
    const firstPage = Array.from({ length: 250 }, (_, index) => makeEntry(index + 1));
    const secondPage = [
      makeEntry(251, {
        content: `${'focus '.repeat(4_000)}tail`,
        tags: ['work', 'growth'],
        date: '2025-02-01',
      }),
    ];
    const queryBuilders = [createQueryBuilder(firstPage), createQueryBuilder(secondPage)];
    const entryRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(queryBuilders[0])
        .mockReturnValueOnce(queryBuilders[1]),
    };
    const aiPersonalityService = {
      analyze: jest.fn().mockResolvedValue({
        traits: [{ label: 'Reflective', score: 80, evidence: 'Reflection words recur.' }],
        summary: 'The writing is consistently reflective.',
      }),
    };
    const service = new StatsPersonalityAnalysisService(
      entryRepository as never,
      aiPersonalityService as never,
    );

    const result = await service.analyze(7, {
      diaryId: 3,
      fromDate: '2024-01-01',
      toDate: '2025-12-31',
    });

    expect(entryRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(queryBuilders[0].where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
    expect(queryBuilders[0].andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    expect(queryBuilders[0].andWhere).toHaveBeenCalledWith('e.date >= :fromDate', {
      fromDate: '2024-01-01',
    });
    expect(queryBuilders[0].andWhere).toHaveBeenCalledWith('e.date <= :toDate', {
      toDate: '2025-12-31',
    });
    expect(queryBuilders[1].andWhere).toHaveBeenCalledWith('e.id > :lastEntryId', {
      lastEntryId: 250,
    });

    const profile = aiPersonalityService.analyze.mock.calls[0]?.[1];
    expect(profile).not.toHaveProperty('content');
    expect(profile.analyzedEntries).toBe(251);
    expect(profile.truncatedEntries).toBe(1);
    expect(profile.topWords.length).toBeLessThanOrEqual(30);
    expect(profile.topSubjects).toEqual([
      { label: 'work', count: 251 },
      { label: 'growth', count: 1 },
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        analyzedEntries: 251,
        fromDate: '2024-01-01',
        toDate: '2025-02-01',
      }),
    );
  });

  it('returns null for empty or wordless scopes without calling AI', async () => {
    const queryBuilder = createQueryBuilder([makeEntry(1, { content: '  ', tags: [] })]);
    const aiPersonalityService = { analyze: jest.fn() };
    const service = new StatsPersonalityAnalysisService(
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as never,
      aiPersonalityService as never,
    );

    await expect(service.analyze(1, {})).resolves.toBeNull();
    expect(aiPersonalityService.analyze).not.toHaveBeenCalled();
  });

  it('returns null when the selected scope has no entries', async () => {
    const queryBuilder = createQueryBuilder([]);
    const aiPersonalityService = { analyze: jest.fn() };
    const service = new StatsPersonalityAnalysisService(
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as never,
      aiPersonalityService as never,
    );

    await expect(service.analyze(1, {})).resolves.toBeNull();
    expect(aiPersonalityService.analyze).not.toHaveBeenCalled();
  });

  it('returns null when AI analysis is unavailable', async () => {
    const queryBuilder = createQueryBuilder([makeEntry(1)]);
    const aiPersonalityService = { analyze: jest.fn().mockResolvedValue(null) };
    const service = new StatsPersonalityAnalysisService(
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as never,
      aiPersonalityService as never,
    );

    await expect(service.analyze(1, {})).resolves.toBeNull();
    expect(aiPersonalityService.analyze).toHaveBeenCalledTimes(1);
  });

  it('rejects an inverted date range before querying entries', async () => {
    const entryRepository = { createQueryBuilder: jest.fn() };
    const service = new StatsPersonalityAnalysisService(
      entryRepository as never,
      { analyze: jest.fn() } as never,
    );

    await expect(
      service.analyze(1, {
        fromDate: '2025-02-01',
        toDate: '2025-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(entryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});

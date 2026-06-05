import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StatsService } from './stats.service';
import { Entry } from '@/database/entities';
import { StatsToneAnalysisService } from './stats-tone-analysis.service';

describe('StatsService', () => {
  let service: StatsService;
  let entryRepository: any;
  let statsToneAnalysisService: { analyze: jest.Mock };

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(100),
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
    };

    entryRepository = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    statsToneAnalysisService = {
      analyze: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: StatsToneAnalysisService, useValue: statsToneAnalysisService },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return complete stats object', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(100);
      mockQb.getRawMany
        .mockResolvedValueOnce([{ year: '2024', count: '50' }, { year: '2023', count: '50' }]) // perYear
        .mockResolvedValueOnce([{ month: '2024-01', count: '25' }, { month: '2024-02', count: '25' }]) // perMonth
        .mockResolvedValueOnce([{ day: '2024-02-20', count: '4' }, { day: '2024-02-19', count: '3' }]) // perDay
        .mockResolvedValueOnce([{ tag: 'happy', count: '30' }, { tag: 'sad', count: '20' }]) // perTag
        .mockResolvedValueOnce([{ year: '2024', tag: 'happy', count: '20' }]) // tagsPerYear
        .mockResolvedValueOnce([{ month: '2024-01', tag: 'happy', count: '10' }]); // tagsPerMonth

      const result = await service.getStats(1);

      expect(result).toHaveProperty('totalThoughts');
      expect(result).toHaveProperty('uniqueTagsCount');
      expect(result).toHaveProperty('thoughtsPerYear');
      expect(result).toHaveProperty('thoughtsPerMonth');
      expect(result).toHaveProperty('thoughtsPerDay');
      expect(result).toHaveProperty('thoughtsPerTag');
      expect(result).toHaveProperty('tagsPerYear');
      expect(result).toHaveProperty('tagsPerMonth');
      expect(result).toHaveProperty('toneMoodAnalysis');
    });

    it('should calculate totalThoughts correctly', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(42);
      mockQb.getRawMany.mockResolvedValue([]);

      const result = await service.getStats(1);

      expect(result.totalThoughts).toBe(42);
    });

    it('should process thoughtsPerYear correctly', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(100);
      mockQb.getRawMany
        .mockResolvedValueOnce([
          { year: '2024', count: '60' },
          { year: '2023', count: '40' },
        ])
        .mockResolvedValue([]);

      const result = await service.getStats(1);

      expect(result.thoughtsPerYear['2024']).toBe(60);
      expect(result.thoughtsPerYear['2023']).toBe(40);
    });

    it('should process thoughtsPerMonth correctly', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(100);
      mockQb.getRawMany
        .mockResolvedValueOnce([]) // perYear
        .mockResolvedValueOnce([
          { month: '2024-01', count: '30' },
          { month: '2024-02', count: '25' },
        ])
        .mockResolvedValue([]);

      const result = await service.getStats(1);

      expect(result.thoughtsPerMonth['2024-01']).toBe(30);
      expect(result.thoughtsPerMonth['2024-02']).toBe(25);
    });

    it('should process thoughtsPerDay correctly', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(100);
      mockQb.getRawMany
        .mockResolvedValueOnce([]) // perYear
        .mockResolvedValueOnce([]) // perMonth
        .mockResolvedValueOnce([
          { day: '2024-02-20', count: '4' },
          { day: '2024-02-19', count: '2' },
        ])
        .mockResolvedValue([]);

      const result = await service.getStats(1);

      expect(result.thoughtsPerDay['2024-02-20']).toBe(4);
      expect(result.thoughtsPerDay['2024-02-19']).toBe(2);
    });

    it('should process thoughtsPerTag correctly', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(100);
      mockQb.getRawMany
        .mockResolvedValueOnce([]) // perYear
        .mockResolvedValueOnce([]) // perMonth
        .mockResolvedValueOnce([]) // perDay
        .mockResolvedValueOnce([
          { tag: 'happy', count: '30' },
          { tag: 'productive', count: '25' },
          { tag: 'tired', count: '15' },
        ])
        .mockResolvedValue([]);

      const result = await service.getStats(1);

      expect(result.thoughtsPerTag['happy']).toBe(30);
      expect(result.thoughtsPerTag['productive']).toBe(25);
      expect(result.uniqueTagsCount).toBe(3);
    });

    it('should process tagsPerYear correctly', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(100);
      mockQb.getRawMany
        .mockResolvedValueOnce([]) // perYear
        .mockResolvedValueOnce([]) // perMonth
        .mockResolvedValueOnce([]) // perDay
        .mockResolvedValueOnce([]) // perTag
        .mockResolvedValueOnce([
          { year: '2024', tag: 'happy', count: '20' },
          { year: '2024', tag: 'sad', count: '10' },
          { year: '2023', tag: 'happy', count: '15' },
        ])
        .mockResolvedValue([]);

      const result = await service.getStats(1);

      expect(result.tagsPerYear['2024']['happy']).toBe(20);
      expect(result.tagsPerYear['2024']['sad']).toBe(10);
      expect(result.tagsPerYear['2023']['happy']).toBe(15);
    });

    it('should process tagsPerMonth correctly', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(100);
      mockQb.getRawMany
        .mockResolvedValueOnce([]) // perYear
        .mockResolvedValueOnce([]) // perMonth
        .mockResolvedValueOnce([]) // perDay
        .mockResolvedValueOnce([]) // perTag
        .mockResolvedValueOnce([]) // tagsPerYear
        .mockResolvedValueOnce([
          { month: '2024-01', tag: 'happy', count: '10' },
          { month: '2024-01', tag: 'sad', count: '5' },
          { month: '2024-02', tag: 'happy', count: '8' },
        ]);

      const result = await service.getStats(1);

      expect(result.tagsPerMonth['2024-01']['happy']).toBe(10);
      expect(result.tagsPerMonth['2024-01']['sad']).toBe(5);
      expect(result.tagsPerMonth['2024-02']['happy']).toBe(8);
    });

    it('should filter by diaryId when provided', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(50);
      mockQb.getRawMany.mockResolvedValue([]);

      await service.getStats(1, 1);

      expect(mockQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 1 });
    });

    it('should include AI tone and mood analysis when available', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getRawMany.mockResolvedValue([]);
      mockQb.getMany.mockResolvedValue([{ id: 9, content: 'I feel calm today.', date: '2024-02-20', tags: ['calm'] }]);
      statsToneAnalysisService.analyze.mockResolvedValue({
        dominantMood: 'calm',
        dominantTone: 'candid',
        moodBreakdown: { calm: 1 },
        toneBreakdown: { candid: 1 },
        analyzedEntries: 1,
        summary: 'The writing feels calm and candid.',
      });

      const result = await service.getStats(1);

      expect(statsToneAnalysisService.analyze).toHaveBeenCalledWith(1, [{ id: 9, content: 'I feel calm today.', date: '2024-02-20', tags: ['calm'] }]);
      expect(result.toneMoodAnalysis).toEqual({
        dominantMood: 'calm',
        dominantTone: 'candid',
        moodBreakdown: { calm: 1 },
        toneBreakdown: { candid: 1 },
        analyzedEntries: 1,
        summary: 'The writing feels calm and candid.',
      });
    });

    it('should return empty objects when no data', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getCount.mockResolvedValue(0);
      mockQb.getRawMany.mockResolvedValue([]);

      const result = await service.getStats(1);

      expect(result.totalThoughts).toBe(0);
      expect(result.uniqueTagsCount).toBe(0);
      expect(Object.keys(result.thoughtsPerYear)).toHaveLength(0);
      expect(Object.keys(result.thoughtsPerMonth)).toHaveLength(0);
      expect(Object.keys(result.thoughtsPerDay)).toHaveLength(0);
      expect(Object.keys(result.thoughtsPerTag)).toHaveLength(0);
      expect(result.toneMoodAnalysis).toBeNull();
    });
  });
});

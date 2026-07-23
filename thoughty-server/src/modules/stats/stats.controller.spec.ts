import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { StatsPersonalityAnalysisService } from './stats-personality-analysis.service';

describe('StatsController', () => {
  let controller: StatsController;
  let statsService: any;
  let statsPersonalityAnalysisService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    statsService = {
      getStats: jest.fn(),
    };
    statsPersonalityAnalysisService = {
      analyze: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        { provide: StatsService, useValue: statsService },
        { provide: StatsPersonalityAnalysisService, useValue: statsPersonalityAnalysisService },
      ],
    }).compile();

    controller = module.get<StatsController>(StatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    it('delegates to statsService.getStats without diaryId', async () => {
      const expected = { totalEntries: 42 };
      statsService.getStats!.mockResolvedValue(expected);

      const result = await controller.getStats(mockUser as any);
      expect(statsService.getStats).toHaveBeenCalledWith(1, undefined);
      expect(result).toBe(expected);
    });

    it('parses diaryId as integer and passes to service', async () => {
      const expected = { totalEntries: 10 };
      statsService.getStats!.mockResolvedValue(expected);

      const result = await controller.getStats(mockUser as any, '5');
      expect(statsService.getStats).toHaveBeenCalledWith(1, 5);
      expect(result).toBe(expected);
    });

    it('passes undefined when diaryId is empty string', async () => {
      const expected = { totalEntries: 42 };
      statsService.getStats!.mockResolvedValue(expected);

      const result = await controller.getStats(mockUser as any, '');
      // parseInt('', 10) returns NaN but since '' is falsy, it goes to undefined
      expect(statsService.getStats).toHaveBeenCalledWith(1, undefined);
      expect(result).toBe(expected);
    });
  });

  describe('analyzePersonality', () => {
    it('delegates the authenticated scope and wraps the result', async () => {
      const analysis = { traits: [{ label: 'Reflective' }] };
      const dto = { diaryId: 2, fromDate: '2024-01-01', toDate: '2024-12-31' };
      statsPersonalityAnalysisService.analyze.mockResolvedValue(analysis);

      await expect(controller.analyzePersonality(mockUser as never, dto)).resolves.toEqual({
        analysis,
      });
      expect(statsPersonalityAnalysisService.analyze).toHaveBeenCalledWith(1, dto);
    });
  });
});

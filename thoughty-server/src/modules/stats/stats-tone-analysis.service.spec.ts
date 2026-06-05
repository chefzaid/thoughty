import { StatsToneAnalysisService } from './stats-tone-analysis.service';

describe('StatsToneAnalysisService', () => {
  it('delegates tone analysis to the AI service', async () => {
    const aiService = {
      analyzeToneMood: jest.fn().mockResolvedValue({ dominantMood: 'calm' }),
    };
    const service = new StatsToneAnalysisService(aiService as never);
    const entries = [{ id: 1, content: 'A calm day', date: '2024-01-01', tags: ['calm'] }];

    await expect(service.analyze(4, entries)).resolves.toEqual({ dominantMood: 'calm' });
    expect(aiService.analyzeToneMood).toHaveBeenCalledWith(4, entries);
  });
});
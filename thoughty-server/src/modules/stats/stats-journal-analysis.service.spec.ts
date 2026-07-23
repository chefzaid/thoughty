import { StatsJournalAnalysisService } from './stats-journal-analysis.service';

describe('StatsJournalAnalysisService', () => {
  it('delegates journal analysis to the AI service', async () => {
    const aiService = {
      analyzeJournal: jest.fn().mockResolvedValue({ subjectAnalysis: { summary: 'Work leads.' } }),
    };
    const service = new StatsJournalAnalysisService(aiService as never);
    const entries = [{ id: 1, content: 'A calm day', date: '2024-01-01', tags: ['calm'] }];

    await expect(service.analyze(4, entries)).resolves.toEqual({
      subjectAnalysis: { summary: 'Work leads.' },
    });
    expect(aiService.analyzeJournal).toHaveBeenCalledWith(4, entries);
  });
});

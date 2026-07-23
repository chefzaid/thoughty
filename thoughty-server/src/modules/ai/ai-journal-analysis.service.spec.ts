import { AiService } from './ai.service';

describe('AiService journal analysis', () => {
  const fetchMock = jest.fn();
  const configService = {
    getDecryptedConfig: jest.fn().mockResolvedValue(''),
  };

  function createService(apiKey = 'sk-or-test-key') {
    process.env.OPENROUTER_API_KEY = apiKey;
    return new AiService(configService as never, {} as never, {} as never);
  }

  beforeEach(() => {
    globalThis.fetch = fetchMock as never;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('returns null when no API key is configured', async () => {
    const service = createService('');

    await expect(
      service.analyzeJournal(1, [{ id: 1, content: 'Entry', date: '2024-01-01', tags: [] }]),
    ).resolves.toBeNull();
  });

  it('returns parsed tone, mood, and subject analysis from one AI request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                dominantMood: 'reflective',
                dominantTone: 'candid',
                moodBreakdown: { reflective: 2, calm: 1 },
                toneBreakdown: { candid: 2, analytical: 1 },
                summary: 'Recent entries are reflective with a candid tone.',
                subjectBreakdown: { wellbeing: 2, work: 1 },
                subjectSummary: 'The entries focus on wellbeing and work.',
              }),
            },
          },
        ],
      }),
    });
    const service = createService();

    const result = await service.analyzeJournal(1, [
      { id: 1, content: 'Today I felt thoughtful.', date: '2024-01-01', tags: ['reflection'] },
      { id: 2, content: 'I am calmer now.', date: '2024-01-02', tags: ['calm'] },
    ]);

    expect(result).toEqual({
      toneMoodAnalysis: {
        dominantMood: 'reflective',
        dominantTone: 'candid',
        moodBreakdown: { reflective: 2, calm: 1 },
        toneBreakdown: { candid: 2, analytical: 1 },
        analyzedEntries: 2,
        summary: 'Recent entries are reflective with a candid tone.',
      },
      subjectAnalysis: {
        subjectBreakdown: { wellbeing: 2, work: 1 },
        analyzedEntries: 2,
        summary: 'The entries focus on wellbeing and work.',
      },
    });
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.messages[0].content).toContain('subjectBreakdown');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when the AI payload is malformed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'not-json' } }],
      }),
    });
    const service = createService();

    await expect(
      service.analyzeJournal(1, [{ id: 1, content: 'Entry', date: '2024-01-01', tags: [] }]),
    ).resolves.toBeNull();
  });
});

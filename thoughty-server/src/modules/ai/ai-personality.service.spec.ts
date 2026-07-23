import { AiPersonalityService } from './ai-personality.service';
import type { WritingProfile } from './personality-analysis';

describe('AiPersonalityService', () => {
  const fetchMock = jest.fn();
  const configService = { getDecryptedConfig: jest.fn().mockResolvedValue('') };
  const profile: WritingProfile = {
    analyzedEntries: 12,
    analyzedWords: 840,
    averageWordsPerEntry: 70,
    truncatedEntries: 0,
    fromDate: '2024-01-01',
    toDate: '2024-12-31',
    topWords: [{ label: 'learning', count: 18 }],
    topSubjects: [{ label: 'work', count: 7 }],
  };

  function createService(apiKey = 'sk-test') {
    process.env.OPENROUTER_API_KEY = apiKey;
    return new AiPersonalityService(configService as never);
  }

  beforeEach(() => {
    globalThis.fetch = fetchMock as never;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('sends only aggregate profile data and parses the response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                traits: [{ label: 'Curious', score: 74, evidence: 'Learning vocabulary recurs.' }],
                summary: 'The writing shows sustained curiosity.',
              }),
            },
          },
        ],
      }),
    });
    const service = createService();

    await expect(service.analyze(4, profile)).resolves.toEqual({
      traits: [{ label: 'Curious', score: 74, evidence: 'Learning vocabulary recurs.' }],
      summary: 'The writing shows sustained curiosity.',
    });

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(JSON.parse(request.messages[1].content)).toEqual(profile);
    expect(request.messages[0].content).toContain('Do not diagnose');
    expect(request.messages[1].content).not.toContain('rawContent');
  });

  it('uses the tone model and returns null when unavailable or malformed', async () => {
    const service = createService();
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(service.analyze(4, profile)).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'bad' } }] }),
    });
    await expect(service.analyze(4, profile)).resolves.toBeNull();
    expect(configService.getDecryptedConfig).toHaveBeenCalledWith(4, 'openRouterToneModel');
  });

  it('does not call OpenRouter without a key or entries', async () => {
    const service = createService('');
    await expect(service.analyze(4, profile)).resolves.toBeNull();

    const configuredService = createService();
    await expect(
      configuredService.analyze(4, { ...profile, analyzedEntries: 0 }),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

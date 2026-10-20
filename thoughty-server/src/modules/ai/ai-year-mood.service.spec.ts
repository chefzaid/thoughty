import { AiYearMoodService } from './ai-year-mood.service';
import type { YearMoodSample } from './year-mood-analysis';

describe('AiYearMoodService', () => {
  const fetchMock = jest.fn();
  const configService = { getDecryptedConfig: jest.fn().mockResolvedValue('') };
  const usageService = { recordResponse: jest.fn() };
  const samples: YearMoodSample[] = [
    { month: '2025-01', entries: [{ date: '2025-01-04', text: 'Snow day with the kids.' }] },
    { month: '2025-02', entries: [{ date: '2025-02-10', text: 'Long week.' }] },
  ];
  const answer = (content: string) => ({ ok: true, json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] }) });

  beforeEach(() => {
    globalThis.fetch = fetchMock as never;
    process.env.OPENROUTER_API_KEY = 'sk-server';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('sends the monthly samples and returns the parsed reading', async () => {
    fetchMock.mockResolvedValue(answer(JSON.stringify({
      months: [{ month: '2025-01', mood: 'playful', valence: 2 }, { month: '2025-02', mood: 'drained', valence: -1 }],
      summary: 'Bright January, heavier February.',
    })));
    const service = new AiYearMoodService(configService as never, usageService as never);

    await expect(service.read(4, samples)).resolves.toEqual({
      months: [{ month: '2025-01', mood: 'playful', valence: 2 }, { month: '2025-02', mood: 'drained', valence: -1 }],
      summary: 'Bright January, heavier February.',
    });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-server');
    expect(request.messages[1].content).toContain('Month 2025-01\n- 2025-01-04: Snow day with the kids.');
    expect(usageService.recordResponse).toHaveBeenCalledWith(4, 'server', 'openai/gpt-4o-mini', expect.any(Object));
  });

  it('returns null without AI, without samples, or when the provider fails', async () => {
    const service = new AiYearMoodService(configService as never);

    await expect(service.read(4, [])).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(service.read(4, samples)).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(answer(''));
    await expect(service.read(4, samples)).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(service.read(4, samples)).resolves.toBeNull();
    delete process.env.OPENROUTER_API_KEY;
    await expect(service.read(4, samples)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

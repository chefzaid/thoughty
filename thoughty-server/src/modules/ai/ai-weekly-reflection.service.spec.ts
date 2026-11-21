import { AiWeeklyReflectionService } from './ai-weekly-reflection.service';

describe('AiWeeklyReflectionService', () => {
  const fetchMock = jest.fn();
  const configService = { getDecryptedConfig: jest.fn().mockResolvedValue('') };
  const usageService = { recordResponse: jest.fn() };
  const week = { from: '2026-11-15', to: '2026-11-21' };
  const entries = [{ date: '2026-11-16', text: 'Planted tulips with Sam.' }];
  const answer = (content: string) => ({ ok: true, json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] }) });

  beforeEach(() => {
    globalThis.fetch = fetchMock as never;
    process.env.OPENROUTER_API_KEY = 'sk-server';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('sends the week’s entries with the summary model and returns the parsed reflection', async () => {
    configService.getDecryptedConfig.mockImplementation(async (_userId: number, key: string) => (key === 'openRouterSummaryModel' ? 'anthropic/claude-haiku' : ''));
    fetchMock.mockResolvedValue(answer(JSON.stringify({ themes: ['garden'], summary: 'A green week.', question: 'What will grow next?' })));
    const service = new AiWeeklyReflectionService(configService as never, usageService as never);

    await expect(service.reflect(4, week, entries)).resolves.toEqual({ themes: ['garden'], summary: 'A green week.', question: 'What will grow next?' });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-server');
    expect(request.model).toBe('anthropic/claude-haiku');
    expect(request.messages[0].content).toContain('one open question for the week ahead');
    expect(request.messages[1].content).toContain('- 2026-11-16: Planted tulips with Sam.');
    expect(usageService.recordResponse).toHaveBeenCalledWith(4, 'server', 'anthropic/claude-haiku', expect.any(Object));
    configService.getDecryptedConfig.mockResolvedValue('');
  });

  it('returns null without entries, without AI, or when the provider fails or answers unusably', async () => {
    const service = new AiWeeklyReflectionService(configService as never);

    await expect(service.reflect(4, week, [])).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(service.reflect(4, week, entries)).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(answer('   '));
    await expect(service.reflect(4, week, entries)).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(answer('{"themes":[]}'));
    await expect(service.reflect(4, week, entries)).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(service.reflect(4, week, entries)).resolves.toBeNull();
    delete process.env.OPENROUTER_API_KEY;
    await expect(service.reflect(4, week, entries)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { AiEntriesChatService } from './ai-entries-chat.service';

describe('AiEntriesChatService', () => {
  const fetchMock = jest.fn();
  const configService = { getDecryptedConfig: jest.fn().mockResolvedValue('') };
  const usageService = { recordResponse: jest.fn() };
  const entries = [{ date: '2026-11-16', title: 'Garden', text: 'Planted tulips with Sam.' }];
  const messages = [
    { role: 'user' as const, content: 'What do these say about me?' },
    { role: 'assistant' as const, content: 'You love the garden [1].' },
    { role: 'user' as const, content: 'And about Sam?' },
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

  it('sends the numbered entries and the whole conversation with the chat model', async () => {
    configService.getDecryptedConfig.mockImplementation(async (_userId: number, key: string) => (key === 'openRouterChatModel' ? 'anthropic/claude-haiku' : ''));
    fetchMock.mockResolvedValue(answer(' Sam is there each spring [1]. '));
    const service = new AiEntriesChatService(configService as never, usageService as never);

    await expect(service.reply(4, entries, messages)).resolves.toBe('Sam is there each spring [1].');
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request.model).toBe('anthropic/claude-haiku');
    expect(request.messages[0]).toMatchObject({ role: 'system' });
    expect(request.messages[0].content).toContain('[1] 2026-11-16 — Garden\nPlanted tulips with Sam.');
    expect(request.messages.slice(1)).toEqual(messages);
    expect(usageService.recordResponse).toHaveBeenCalledWith(4, 'server', 'anthropic/claude-haiku', expect.any(Object));
    configService.getDecryptedConfig.mockResolvedValue('');
  });

  it('is refused without AI, and fails when the provider fails or answers nothing', async () => {
    const service = new AiEntriesChatService(configService as never);

    fetchMock.mockResolvedValueOnce({ ok: false });
    await expectApiError(service.reply(4, entries, messages), BadGatewayException, 'AI_PROVIDER_FAILED');
    fetchMock.mockResolvedValueOnce(answer('   '));
    await expectApiError(service.reply(4, entries, messages), BadGatewayException, 'AI_PROVIDER_FAILED');
    delete process.env.OPENROUTER_API_KEY;
    await expectApiError(service.reply(4, entries, messages), BadRequestException, 'AI_KEY_NOT_CONFIGURED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

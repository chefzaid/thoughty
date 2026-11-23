import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { AiMemoirFollowUpsService } from './ai-memoir-follow-ups.service';

describe('AiMemoirFollowUpsService', () => {
  const fetchMock = jest.fn();
  const configService = { getDecryptedConfig: jest.fn().mockResolvedValue('') };
  const usageService = { recordResponse: jest.fn() };
  const request = { question: 'What did your home look like?', answer: 'A fig tree by my window.', asked: ['Who planted it?'] };
  const answer = (content: string) => ({ ok: true, json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] }) });

  beforeEach(() => {
    globalThis.fetch = fetchMock as never;
    process.env.OPENROUTER_API_KEY = 'sk-server';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('asks the prompt model about the answer and returns the questions not yet asked', async () => {
    configService.getDecryptedConfig.mockImplementation(async (_userId: number, key: string) => (key === 'openRouterPromptModel' ? 'mistral/small' : ''));
    fetchMock.mockResolvedValue(answer('{"questions":["Who planted it?","What fruit did the fig tree give?"]}'));
    const service = new AiMemoirFollowUpsService(configService as never, usageService as never);

    await expect(service.suggest(4, request)).resolves.toEqual(['What fruit did the fig tree give?']);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe('mistral/small');
    expect(body.messages[0]).toMatchObject({ role: 'system', content: expect.stringContaining('memoir') });
    expect(body.messages[1].content).toContain('<memoir_answer>\nA fig tree by my window.\n</memoir_answer>');
    expect(usageService.recordResponse).toHaveBeenCalledWith(4, 'server', 'mistral/small', expect.any(Object));
    configService.getDecryptedConfig.mockResolvedValue('');
  });

  it('is refused without AI, and fails when the provider fails or its answer cannot be read', async () => {
    const service = new AiMemoirFollowUpsService(configService as never);

    fetchMock.mockResolvedValueOnce({ ok: false });
    await expectApiError(service.suggest(4, request), BadGatewayException, 'AI_PROVIDER_FAILED');
    fetchMock.mockResolvedValueOnce(answer('I would ask about the tree.'));
    await expectApiError(service.suggest(4, request), BadGatewayException, 'AI_PROVIDER_FAILED');
    delete process.env.OPENROUTER_API_KEY;
    await expectApiError(service.suggest(4, request), BadRequestException, 'AI_KEY_NOT_CONFIGURED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

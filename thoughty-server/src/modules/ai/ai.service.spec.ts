import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiServiceTestBed, createAiServiceTestBed } from './ai-service.test-helpers';

describe('AiService', () => {
  let service: AiService;
  let configService: AiServiceTestBed['configService'];
  const fetchMock = jest.fn();

  const createService = async (apiKey?: string) => {
    const bed = await createAiServiceTestBed(apiKey);
    ({ configService } = bed);
    return bed.service;
  };

  beforeEach(async () => {
    service = await createService();
    globalThis.fetch = fetchMock as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('throws when content is empty', async () => {
    await expect(service.suggestTags(1, { content: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('throws when no OpenRouter API key is configured', async () => {
    service = await createService('');

    await expect(service.suggestTags(1, { content: 'Need tags' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns normalized tag suggestions', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '["Deep Work", "Focus", "focus", "#Writing"]',
            },
          },
        ],
      }),
    });

    const result = await service.suggestTags(1, {
      content: 'I wrote a long reflection about focus and writing.',
      existingTags: ['journal'],
      maxTags: 3,
    });

    expect(result).toEqual({ tags: ['deep-work', 'focus', 'writing'] });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-or-test-key' }),
      }),
    );
  });

  it('filters tags that already exist on the draft', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '["focus", "review", "planning"]',
            },
          },
        ],
      }),
    });

    const result = await service.suggestTags(1, {
      content: 'Review the sprint planning board.',
      existingTags: ['focus'],
    });

    expect(result).toEqual({ tags: ['review', 'planning'] });
  });

  it('throws when OpenRouter returns an error', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

    await expect(service.suggestTags(1, { content: 'Need tags' })).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('returns an empty array for auto-tagging when the API key is missing', async () => {
    service = await createService('');

    const result = await service.autoTagEntry(1, 'Write about focus', [], 3);

    expect(result).toEqual([]);
  });

  it('returns tags for auto-tagging when the AI request succeeds', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '["focus", "planning", "review"]',
            },
          },
        ],
      }),
    });

    const result = await service.autoTagEntry(1, 'Review the sprint plan', ['journal'], 2);

    expect(result).toEqual(['focus', 'planning']);
  });

  describe('listModels', () => {
    it('throws when no API key is configured', async () => {
      service = await createService('');

      await expect(service.listModels()).rejects.toThrow(BadRequestException);
    });

    it('throws when OpenRouter returns an error', async () => {
      fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

      await expect(service.listModels()).rejects.toThrow(BadGatewayException);
    });

    it('returns sorted models from OpenRouter', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [
            { id: 'openai/gpt-4o', name: 'GPT-4o' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'meta/llama-3', name: 'Llama 3' },
          ],
        }),
      });

      const result = await service.listModels();

      expect(result).toEqual([
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'meta/llama-3', name: 'Llama 3' },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer sk-or-test-key' }),
        }),
      );
    });

    it('filters out models with missing id or name', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [
            { id: 'openai/gpt-4o', name: 'GPT-4o' },
            { id: 'broken-model' },
            { name: 'No ID Model' },
            { id: null, name: null },
          ],
        }),
      });

      const result = await service.listModels();

      expect(result).toEqual([{ id: 'openai/gpt-4o', name: 'GPT-4o' }]);
    });
  });

  describe('getModel (model resolution)', () => {
    const mockOpenRouterResponse = (content: string) =>
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] }),
      });
    const requestedModel = () => JSON.parse(fetchMock.mock.calls[0][1].body).model;

    it('uses task-specific configured model from user settings', async () => {
      configService.getDecryptedConfig.mockResolvedValueOnce('anthropic/claude-3.5-sonnet');
      mockOpenRouterResponse('["focus"]');

      await service.suggestTags(1, { content: 'Test entry' });

      expect(requestedModel()).toBe('anthropic/claude-3.5-sonnet');
      expect(configService.getDecryptedConfig).toHaveBeenCalledWith(1, 'openRouterTagModel');
    });

    it('falls back to the default configured model when task-specific model is empty', async () => {
      configService.getDecryptedConfig
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('openai/gpt-4o');
      mockOpenRouterResponse('Corrected text');

      await service.fixWriting(1, { content: 'teh text', mode: 'grammar' });

      expect(requestedModel()).toBe('openai/gpt-4o');
      expect(configService.getDecryptedConfig).toHaveBeenNthCalledWith(
        1,
        1,
        'openRouterWritingModel',
      );
      expect(configService.getDecryptedConfig).toHaveBeenNthCalledWith(2, 1, 'openRouterModel');
    });

    it('falls back to default model when none configured', async () => {
      mockOpenRouterResponse('["focus"]');

      await service.suggestTags(1, { content: 'Test entry' });

      expect(requestedModel()).toBe('openai/gpt-4o-mini');
    });
  });
});

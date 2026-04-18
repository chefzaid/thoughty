import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@/modules/config';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  let configService: { getDecryptedConfig: jest.Mock };
  const fetchMock = jest.fn();

  beforeEach(async () => {
    configService = {
      getDecryptedConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws when content is empty', async () => {
    await expect(service.suggestTags(1, { content: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('throws when no OpenRouter API key is configured', async () => {
    configService.getDecryptedConfig.mockResolvedValue('');

    await expect(service.suggestTags(1, { content: 'Need tags' })).rejects.toThrow(BadRequestException);
  });

  it('returns normalized tag suggestions', async () => {
    configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
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
    configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
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
    configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
    fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

    await expect(service.suggestTags(1, { content: 'Need tags' })).rejects.toThrow(BadGatewayException);
  });

  it('returns an empty array for auto-tagging when the API key is missing', async () => {
    configService.getDecryptedConfig.mockResolvedValue('');

    const result = await service.autoTagEntry(1, 'Write about focus', [], 3);

    expect(result).toEqual([]);
  });

  it('returns tags for auto-tagging when the AI request succeeds', async () => {
    configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
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

  describe('fixWriting', () => {
    it('throws when content is empty', async () => {
      await expect(service.fixWriting(1, { content: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('throws when no OpenRouter API key is configured', async () => {
      configService.getDecryptedConfig.mockResolvedValue('');

      await expect(service.fixWriting(1, { content: 'Fix this' })).rejects.toThrow(BadRequestException);
    });

    it('returns corrected content from the AI', async () => {
      configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'I went to the store and bought some apples.',
              },
            },
          ],
        }),
      });

      const result = await service.fixWriting(1, { content: 'I gone to the store and buyed some appls.' });

      expect(result).toEqual({ content: 'I went to the store and bought some apples.' });
    });

    it('returns original content when AI response is empty', async () => {
      configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '' } }],
        }),
      });

      const result = await service.fixWriting(1, { content: 'Hello world' });

      expect(result).toEqual({ content: 'Hello world' });
    });

    it('throws when OpenRouter returns an error', async () => {
      configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
      fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

      await expect(service.fixWriting(1, { content: 'Fix this' })).rejects.toThrow(BadGatewayException);
    });
  });

  describe('chat', () => {
    const chatDto = {
      entryContent: 'Today I felt overwhelmed by all the tasks at work.',
      messages: [{ role: 'user' as const, content: 'What do you think about this entry?' }],
    };

    it('throws when entry content is empty', async () => {
      await expect(service.chat(1, { ...chatDto, entryContent: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('throws when messages array is empty', async () => {
      await expect(service.chat(1, { ...chatDto, messages: [] })).rejects.toThrow(BadRequestException);
    });

    it('throws when no OpenRouter API key is configured', async () => {
      configService.getDecryptedConfig.mockResolvedValue('');

      await expect(service.chat(1, chatDto)).rejects.toThrow(BadRequestException);
    });

    it('returns the AI reply', async () => {
      configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'It sounds like you had a tough day. What tasks felt most overwhelming?',
              },
            },
          ],
        }),
      });

      const result = await service.chat(1, chatDto);

      expect(result).toEqual({
        reply: 'It sounds like you had a tough day. What tasks felt most overwhelming?',
      });
    });

    it('throws when OpenRouter returns an error', async () => {
      configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
      fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

      await expect(service.chat(1, chatDto)).rejects.toThrow(BadGatewayException);
    });

    it('throws when AI returns an empty response', async () => {
      configService.getDecryptedConfig.mockResolvedValue('sk-or-test-key');
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '' } }],
        }),
      });

      await expect(service.chat(1, chatDto)).rejects.toThrow(BadGatewayException);
    });
  });
});
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiChatHistory, Entry } from '@/database/entities';
import { ConfigService } from '@/modules/config';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  let configService: { getDecryptedConfig: jest.Mock };
  let entryRepository: { findOne: jest.Mock };
  let chatHistoryRepository: { findOne: jest.Mock; save: jest.Mock };
  const fetchMock = jest.fn();

  const createService = async (apiKey = 'sk-or-test-key') => {
    process.env.OPENROUTER_API_KEY = apiKey;

    configService = {
      getDecryptedConfig: jest.fn().mockResolvedValue(''),
    };

    entryRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 10, userId: 1, content: 'Saved entry' }),
    };

    chatHistoryRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (value) => value),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(AiChatHistory), useValue: chatHistoryRepository },
      ],
    }).compile();

    return module.get<AiService>(AiService);
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

    await expect(service.suggestTags(1, { content: 'Need tags' })).rejects.toThrow(BadRequestException);
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

    await expect(service.suggestTags(1, { content: 'Need tags' })).rejects.toThrow(BadGatewayException);
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

  describe('fixWriting', () => {
    it('throws when content is empty', async () => {
      await expect(service.fixWriting(1, { content: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('throws when no OpenRouter API key is configured', async () => {
      service = await createService('');

      await expect(service.fixWriting(1, { content: 'Fix this' })).rejects.toThrow(BadRequestException);
    });

    it('returns corrected content from the AI', async () => {
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

    it('uses the requested rewrite mode in the AI prompt', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'A fully rewritten paragraph.',
              },
            },
          ],
        }),
      });

      await service.fixWriting(1, { content: 'Rewrite this.', mode: 'rewrite' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('Rewrite the text completely for clarity, flow, and readability'),
        }),
      );
    });

    it('returns original content when AI response is empty', async () => {
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
      fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

      await expect(service.fixWriting(1, { content: 'Fix this' })).rejects.toThrow(BadGatewayException);
    });
  });

  describe('analyzeToneMood', () => {
    it('returns null when no API key is configured', async () => {
      service = await createService('');

      await expect(service.analyzeToneMood(1, [{ id: 1, content: 'Entry', date: '2024-01-01', tags: [] }])).resolves.toBeNull();
    });

    it('returns parsed tone and mood analysis from the AI', async () => {
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
                }),
              },
            },
          ],
        }),
      });

      const result = await service.analyzeToneMood(1, [
        { id: 1, content: 'Today I felt thoughtful.', date: '2024-01-01', tags: ['reflection'] },
        { id: 2, content: 'I am calmer now.', date: '2024-01-02', tags: ['calm'] },
      ]);

      expect(result).toEqual({
        dominantMood: 'reflective',
        dominantTone: 'candid',
        moodBreakdown: { reflective: 2, calm: 1 },
        toneBreakdown: { candid: 2, analytical: 1 },
        analyzedEntries: 2,
        summary: 'Recent entries are reflective with a candid tone.',
      });
    });

    it('returns null when the AI payload is malformed', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'not-json' } }],
        }),
      });

      await expect(service.analyzeToneMood(1, [{ id: 1, content: 'Entry', date: '2024-01-01', tags: [] }])).resolves.toBeNull();
    });
  });

  describe('chat', () => {
    const chatDto = {
      entryId: 10,
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
      service = await createService('');

      await expect(service.chat(1, chatDto)).rejects.toThrow(BadRequestException);
    });

    it('throws when the entry does not belong to the user', async () => {
      entryRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.chat(1, chatDto)).rejects.toThrow('Entry not found');
    });

    it('returns the AI reply', async () => {
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
      expect(chatHistoryRepository.save).toHaveBeenCalledWith({
        userId: 1,
        entryId: 10,
        messages: [
          { role: 'user', content: 'What do you think about this entry?' },
          { role: 'assistant', content: 'It sounds like you had a tough day. What tasks felt most overwhelming?' },
        ],
      });
    });

    it('updates an existing persisted history when the chat succeeds', async () => {
      chatHistoryRepository.findOne.mockResolvedValueOnce({ id: 7, userId: 1, entryId: 10, messages: [] });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Try naming the hardest task first.' } }],
        }),
      });

      await service.chat(1, chatDto);

      expect(chatHistoryRepository.save).toHaveBeenCalledWith({
        id: 7,
        userId: 1,
        entryId: 10,
        messages: [
          { role: 'user', content: 'What do you think about this entry?' },
          { role: 'assistant', content: 'Try naming the hardest task first.' },
        ],
      });
    });

    it('throws when OpenRouter returns an error', async () => {
      fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

      await expect(service.chat(1, chatDto)).rejects.toThrow(BadGatewayException);
    });

    it('throws when AI returns an empty response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '' } }],
        }),
      });

      await expect(service.chat(1, chatDto)).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getChatHistory', () => {
    it('returns an empty history when nothing has been stored yet', async () => {
      chatHistoryRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getChatHistory(1, 10)).resolves.toEqual({
        entryId: 10,
        messages: [],
      });
    });

    it('returns persisted history for the entry', async () => {
      chatHistoryRepository.findOne.mockResolvedValueOnce({
        id: 4,
        userId: 1,
        entryId: 10,
        messages: [{ role: 'assistant', content: 'Saved reflection' }],
      });

      await expect(service.getChatHistory(1, 10)).resolves.toEqual({
        entryId: 10,
        messages: [{ role: 'assistant', content: 'Saved reflection' }],
      });
    });

    it('throws when the entry does not belong to the user', async () => {
      entryRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getChatHistory(1, 999)).rejects.toThrow('Entry not found');
    });
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
    it('uses configured model from user settings', async () => {
      configService.getDecryptedConfig
        .mockResolvedValueOnce('anthropic/claude-3.5-sonnet');

      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '["focus"]' } }],
        }),
      });

      await service.suggestTags(1, { content: 'Test entry' });

      const fetchCall = fetchMock.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('falls back to default model when none configured', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '["focus"]' } }],
        }),
      });

      await service.suggestTags(1, { content: 'Test entry' });

      const fetchCall = fetchMock.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.model).toBe('openai/gpt-4o-mini');
    });
  });
});

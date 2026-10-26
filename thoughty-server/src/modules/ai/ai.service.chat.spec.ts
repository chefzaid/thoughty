import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiServiceTestBed, createAiServiceTestBed } from './ai-service.test-helpers';
import { UNTRUSTED_CONTENT_INSTRUCTION } from './untrusted-content';

describe('AiService', () => {
  let service: AiService;
  let entryRepository: AiServiceTestBed['entryRepository'];
  let chatHistoryRepository: AiServiceTestBed['chatHistoryRepository'];
  const fetchMock = jest.fn();

  const createService = async (apiKey?: string) => {
    const bed = await createAiServiceTestBed(apiKey);
    ({ entryRepository, chatHistoryRepository } = bed);
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

  describe('chat', () => {
    const chatDto = {
      entryId: 10,
      entryContent: 'Today I felt overwhelmed by all the tasks at work.',
      messages: [{ role: 'user' as const, content: 'What do you think about this entry?' }],
    };

    it('throws when entry content is empty', async () => {
      await expect(service.chat(1, { ...chatDto, entryContent: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when messages array is empty', async () => {
      await expect(service.chat(1, { ...chatDto, messages: [] })).rejects.toThrow(
        BadRequestException,
      );
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
          {
            role: 'assistant',
            content: 'It sounds like you had a tough day. What tasks felt most overwhelming?',
          },
        ],
      });
    });

    it('keeps the entry in a delimited untrusted block of the system prompt', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Tell me more.' } }] }),
      });

      await service.chat(1, chatDto);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain(UNTRUSTED_CONTENT_INSTRUCTION);
      expect(body.messages[0].content).toMatch(
        /\n<journal_entry>\nToday I felt overwhelmed by all the tasks at work\.\n<\/journal_entry>$/,
      );
      expect(body.messages.slice(1)).toEqual(chatDto.messages);
    });

    it('updates an existing persisted history when the chat succeeds', async () => {
      chatHistoryRepository.findOne.mockResolvedValueOnce({
        id: 7,
        userId: 1,
        entryId: 10,
        messages: [],
      });
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
});

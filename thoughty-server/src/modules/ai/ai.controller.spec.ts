import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;
  let aiService: {
    suggestTags: jest.Mock;
    chat: jest.Mock;
    getChatHistory: jest.Mock;
    listModels: jest.Mock;
  };

  beforeEach(async () => {
    aiService = {
      suggestTags: jest.fn(),
      chat: jest.fn(),
      getChatHistory: jest.fn(),
      listModels: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: aiService }],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('delegates tag suggestions to the service', async () => {
    aiService.suggestTags.mockResolvedValue({ tags: ['focus', 'work'] });

    const result = await controller.suggestTags(
      { userId: 1, email: 'test@example.com' } as any,
      { content: 'Ship the sprint planning notes', existingTags: ['planning'], maxTags: 5 },
    );

    expect(aiService.suggestTags).toHaveBeenCalledWith(1, {
      content: 'Ship the sprint planning notes',
      existingTags: ['planning'],
      maxTags: 5,
    });
    expect(result).toEqual({ tags: ['focus', 'work'] });
  });

  it('delegates chat to the service', async () => {
    aiService.chat.mockResolvedValue({ reply: 'It sounds like you need rest.' });

    const result = await controller.chat(
      { userId: 1, email: 'test@example.com' } as any,
      {
        entryId: 42,
        entryContent: 'Today was exhausting.',
        messages: [{ role: 'user', content: 'What stands out?' }],
      },
    );

    expect(aiService.chat).toHaveBeenCalledWith(1, {
      entryId: 42,
      entryContent: 'Today was exhausting.',
      messages: [{ role: 'user', content: 'What stands out?' }],
    });
    expect(result).toEqual({ reply: 'It sounds like you need rest.' });
  });

  it('delegates chat history lookup to the service', async () => {
    aiService.getChatHistory.mockResolvedValue({
      entryId: 42,
      messages: [{ role: 'assistant', content: 'Saved response' }],
    });

    const result = await controller.getHistory(
      { userId: 1, email: 'test@example.com' } as any,
      42,
    );

    expect(aiService.getChatHistory).toHaveBeenCalledWith(1, 42);
    expect(result).toEqual({
      entryId: 42,
      messages: [{ role: 'assistant', content: 'Saved response' }],
    });
  });
});
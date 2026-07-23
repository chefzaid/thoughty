import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;
  let aiService: {
    suggestTags: jest.Mock;
    summarizeEntry: jest.Mock;
    generateWritingPrompts: jest.Mock;
    chat: jest.Mock;
    getChatHistory: jest.Mock;
    listModels: jest.Mock;
  };

  beforeEach(async () => {
    aiService = {
      suggestTags: jest.fn(),
      summarizeEntry: jest.fn(),
      generateWritingPrompts: jest.fn(),
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

    const result = await controller.suggestTags({ userId: 1, email: 'test@example.com' } as any, {
      content: 'Ship the sprint planning notes',
      existingTags: ['planning'],
      maxTags: 5,
    });

    expect(aiService.suggestTags).toHaveBeenCalledWith(1, {
      content: 'Ship the sprint planning notes',
      existingTags: ['planning'],
      maxTags: 5,
    });
    expect(result).toEqual({ tags: ['focus', 'work'] });
  });

  it('delegates chat to the service', async () => {
    aiService.chat.mockResolvedValue({ reply: 'It sounds like you need rest.' });

    const result = await controller.chat({ userId: 1, email: 'test@example.com' } as any, {
      entryId: 42,
      entryContent: 'Today was exhausting.',
      messages: [{ role: 'user', content: 'What stands out?' }],
    });

    expect(aiService.chat).toHaveBeenCalledWith(1, {
      entryId: 42,
      entryContent: 'Today was exhausting.',
      messages: [{ role: 'user', content: 'What stands out?' }],
    });
    expect(result).toEqual({ reply: 'It sounds like you need rest.' });
  });

  it('delegates entry summaries to the service', async () => {
    aiService.summarizeEntry.mockResolvedValue({ summary: 'A concise summary.' });
    const dto = {
      entryId: 42,
      includeDetails: 'the decision',
      excludeDetails: 'names',
    };

    const result = await controller.summarizeEntry(
      { userId: 1, email: 'test@example.com' } as any,
      dto,
    );

    expect(aiService.summarizeEntry).toHaveBeenCalledWith(1, dto);
    expect(result).toEqual({ summary: 'A concise summary.' });
  });

  it('delegates writing prompt generation to the service', async () => {
    aiService.generateWritingPrompts.mockResolvedValue({
      prompts: ['What deserves more attention?'],
    });

    const result = await controller.generateWritingPrompts(
      { userId: 1, email: 'test@example.com' } as any,
      { diaryId: 4 },
    );

    expect(aiService.generateWritingPrompts).toHaveBeenCalledWith(1, { diaryId: 4 });
    expect(result).toEqual({ prompts: ['What deserves more attention?'] });
  });

  it('delegates chat history lookup to the service', async () => {
    aiService.getChatHistory.mockResolvedValue({
      entryId: 42,
      messages: [{ role: 'assistant', content: 'Saved response' }],
    });

    const result = await controller.getHistory({ userId: 1, email: 'test@example.com' } as any, 42);

    expect(aiService.getChatHistory).toHaveBeenCalledWith(1, 42);
    expect(result).toEqual({
      entryId: 42,
      messages: [{ role: 'assistant', content: 'Saved response' }],
    });
  });
});

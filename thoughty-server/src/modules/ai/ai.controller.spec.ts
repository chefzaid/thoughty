import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiDuplicateService } from './ai-duplicate.service';
import { AiSemanticSearchService } from './ai-semantic-search.service';
import { AiCredentialsService } from './ai-credentials.service';

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
  let aiDuplicateService: { findDuplicates: jest.Mock };
  let aiSemanticSearchService: { search: jest.Mock };
  let aiCredentialsService: {
    getStatus: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    getUsage: jest.Mock;
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
    aiDuplicateService = { findDuplicates: jest.fn() };
    aiSemanticSearchService = { search: jest.fn() };
    aiCredentialsService = {
      getStatus: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      getUsage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: aiService },
        { provide: AiDuplicateService, useValue: aiDuplicateService },
        { provide: AiSemanticSearchService, useValue: aiSemanticSearchService },
        { provide: AiCredentialsService, useValue: aiCredentialsService },
      ],
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

  it('uses the current user credential for model listing', async () => {
    aiService.listModels.mockResolvedValue([{ id: 'openai/model', name: 'Model' }]);

    await expect(
      controller.listModels({ userId: 8, email: 'test@example.com' } as any),
    ).resolves.toEqual([{ id: 'openai/model', name: 'Model' }]);
    expect(aiService.listModels).toHaveBeenCalledWith(8);
  });

  it('manages the current user personal credential and usage', async () => {
    const user = { userId: 8, email: 'test@example.com' } as any;
    const status = {
      hasPersonalKey: true,
      keyHint: '...value',
      source: 'personal' as const,
      aiAvailable: true,
    };
    aiCredentialsService.getStatus.mockResolvedValue(status);
    aiCredentialsService.save.mockResolvedValue(status);
    aiCredentialsService.remove.mockResolvedValue({ ...status, hasPersonalKey: false });
    aiCredentialsService.getUsage.mockResolvedValue({ provider: {}, thoughty: {} });

    await expect(controller.getCredentialStatus(user)).resolves.toEqual(status);
    await expect(
      controller.saveCredential(user, { apiKey: 'sk-or-v1-example-key-value' }),
    ).resolves.toEqual(status);
    await controller.removeCredential(user);
    await controller.getUsage(user);

    expect(aiCredentialsService.getStatus).toHaveBeenCalledWith(8);
    expect(aiCredentialsService.save).toHaveBeenCalledWith(8, 'sk-or-v1-example-key-value');
    expect(aiCredentialsService.remove).toHaveBeenCalledWith(8);
    expect(aiCredentialsService.getUsage).toHaveBeenCalledWith(8);
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

  it('delegates duplicate scans to the user-scoped service', async () => {
    aiDuplicateService.findDuplicates.mockResolvedValue({
      analyzedEntries: 2,
      totalEntries: 2,
      truncated: false,
      groups: [],
    });

    const result = await controller.findDuplicates(
      { userId: 1, email: 'test@example.com' } as any,
      { diaryId: 4 },
    );

    expect(aiDuplicateService.findDuplicates).toHaveBeenCalledWith(1, { diaryId: 4 });
    expect(result.groups).toEqual([]);
  });

  it('delegates semantic search to the user-scoped service', async () => {
    aiSemanticSearchService.search.mockResolvedValue({
      analyzedEntries: 2,
      totalEntries: 2,
      truncated: false,
      matches: [{ entryId: 12, score: 0.9 }],
    });

    const result = await controller.semanticSearch(
      { userId: 1, email: 'test@example.com' } as any,
      { query: 'a career decision', diaryId: 4 },
    );

    expect(aiSemanticSearchService.search).toHaveBeenCalledWith(1, {
      query: 'a career decision',
      diaryId: 4,
    });
    expect(result.matches).toEqual([{ entryId: 12, score: 0.9 }]);
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

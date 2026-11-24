import { In } from 'typeorm';
import { featureFlagsWith } from '@/common/feature-flags/feature-flags.test-helpers';
import { EntryTaggingService } from './entry-tagging.service';

describe('EntryTaggingService', () => {
  let service: EntryTaggingService;
  let configService: Record<string, jest.Mock>;
  let aiService: Record<string, jest.Mock>;
  let diaryRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    configService = {
      getConfig: jest.fn().mockResolvedValue({ autoTagMaxTags: '0' }),
    };

    aiService = {
      autoTagEntry: jest.fn().mockResolvedValue([]),
    };

    diaryRepository = { exists: jest.fn().mockResolvedValue(false) };

    service = new EntryTaggingService(configService as never, aiService as never, featureFlagsWith(), diaryRepository as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes and deduplicates input tags before requesting AI suggestions', async () => {
    configService.getConfig.mockResolvedValue({ autoTagMaxTags: '3' });
    aiService.autoTagEntry.mockResolvedValue(['ai']);

    const result = await service.resolveSavedTags(5, 'Hello world', [' work ', 'work']);

    expect(aiService.autoTagEntry).toHaveBeenCalledWith(5, 'Hello world', ['work'], 2);
    expect(result).toEqual(['work', 'ai']);
  });

  it('saves the given tags without asking AI in a diary with AI off, set to ask or on the writer’s own model, and asks in one with AI on', async () => {
    configService.getConfig.mockResolvedValue({ autoTagMaxTags: '3' });
    diaryRepository.exists.mockResolvedValue(true);

    await expect(service.resolveSavedTags(5, 'Hello world', ['work'], 8)).resolves.toEqual(['work']);
    expect(diaryRepository.exists).toHaveBeenCalledWith({ where: { id: 8, userId: 5, aiMode: In(['off', 'ask', 'local']) } });
    expect(aiService.autoTagEntry).not.toHaveBeenCalled();

    diaryRepository.exists.mockResolvedValue(false);
    aiService.autoTagEntry.mockResolvedValue(['ai']);
    await expect(service.resolveSavedTags(5, 'Hello world', ['work'], 9)).resolves.toEqual(['work', 'ai']);
  });

  it('returns sanitized tags without AI suggestions when auto-tagging is disabled', async () => {
    const result = await service.resolveSavedTags(2, 'Manual tags only', [' focus ', 'focus']);

    expect(aiService.autoTagEntry).not.toHaveBeenCalled();
    expect(result).toEqual(['focus']);
  });

  it('saves the given tags without asking AI while AI is switched off', async () => {
    configService.getConfig.mockResolvedValue({ autoTagMaxTags: '3' });
    service = new EntryTaggingService(configService as never, aiService as never, featureFlagsWith({ ai: false }), diaryRepository as never);

    const result = await service.resolveSavedTags(5, 'Hello world', ['work']);

    expect(aiService.autoTagEntry).not.toHaveBeenCalled();
    expect(result).toEqual(['work']);
  });
});

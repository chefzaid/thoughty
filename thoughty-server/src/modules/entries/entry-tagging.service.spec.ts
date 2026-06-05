import { EntryTaggingService } from './entry-tagging.service';

describe('EntryTaggingService', () => {
  let service: EntryTaggingService;
  let configService: Record<string, jest.Mock>;
  let aiService: Record<string, jest.Mock>;

  beforeEach(() => {
    configService = {
      getConfig: jest.fn().mockResolvedValue({ autoTagMaxTags: '0' }),
    };

    aiService = {
      autoTagEntry: jest.fn().mockResolvedValue([]),
    };

    service = new EntryTaggingService(configService as never, aiService as never);
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

  it('returns sanitized tags without AI suggestions when auto-tagging is disabled', async () => {
    const result = await service.resolveSavedTags(2, 'Manual tags only', [' focus ', 'focus']);

    expect(aiService.autoTagEntry).not.toHaveBeenCalled();
    expect(result).toEqual(['focus']);
  });
});
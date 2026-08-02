import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AiJournalRetagService } from './ai-journal-retag.service';
import { requestJournalRetagPlan } from './journal-retagging';

jest.mock('./journal-retagging', () => ({
  ...jest.requireActual('./journal-retagging'),
  requestJournalRetagPlan: jest.fn(),
}));

describe('AiJournalRetagService', () => {
  const repository = { findAndCount: jest.fn(), find: jest.fn(), save: jest.fn() };
  const configService = { getDecryptedConfig: jest.fn() };
  const usageService = { reporter: jest.fn() };
  let service: AiJournalRetagService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    configService.getDecryptedConfig.mockImplementation(async (_userId: number, key: string) =>
      key === 'openRouterApiKey' ? 'sk-or-v1-personal' : 'provider/model',
    );
    usageService.reporter.mockReturnValue(jest.fn());
    repository.save.mockImplementation(async (entries) => entries);
    service = new AiJournalRetagService(
      configService as never,
      repository as never,
      usageService as never,
    );
  });

  it('creates a reviewable plan for owned entries', async () => {
    repository.findAndCount.mockResolvedValue([
      [
        { id: 1, date: '2026-01-01', index: 1, content: 'Learning steadily', tags: ['study'] },
        { id: 2, date: '2026-01-02', index: 1, content: 'Dinner with friends', tags: ['friends'] },
      ],
      350,
    ]);
    jest.mocked(requestJournalRetagPlan).mockResolvedValue({
      themes: ['growth', 'belonging'],
      assignments: [
        { entryId: 1, tags: ['growth'] },
        { entryId: 2, tags: ['belonging'] },
      ],
    });

    await expect(service.createPlan(7)).resolves.toEqual({
      analyzedEntries: 2,
      totalEntries: 350,
      truncated: true,
      themes: ['growth', 'belonging'],
      entries: [
        { id: 1, date: '2026-01-01', index: 1, currentTags: ['study'], suggestedTags: ['growth'] },
        {
          id: 2,
          date: '2026-01-02',
          index: 1,
          currentTags: ['friends'],
          suggestedTags: ['belonging'],
        },
      ],
    });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7 },
        take: 300,
      }),
    );
    expect(requestJournalRetagPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-or-v1-personal',
        model: 'provider/model',
      }),
    );
  });

  it('returns an empty plan without resolving credentials for an empty journal', async () => {
    repository.findAndCount.mockResolvedValue([[], 0]);

    await expect(service.createPlan(7)).resolves.toEqual({
      analyzedEntries: 0,
      totalEntries: 0,
      truncated: false,
      themes: [],
      entries: [],
    });
    expect(configService.getDecryptedConfig).not.toHaveBeenCalled();
  });

  it('requires an AI credential and a valid provider plan', async () => {
    repository.findAndCount.mockResolvedValue([
      [{ id: 1, date: '2026-01-01', index: 1, content: 'Entry', tags: [] }],
      1,
    ]);
    configService.getDecryptedConfig.mockResolvedValue('');
    await expect(service.createPlan(7)).rejects.toThrow(BadRequestException);

    configService.getDecryptedConfig.mockResolvedValue('provider/model');
    process.env.OPENROUTER_API_KEY = 'server-key';
    jest.mocked(requestJournalRetagPlan).mockResolvedValue({ themes: [], assignments: [] });
    await expect(service.createPlan(7)).rejects.toThrow(BadGatewayException);
  });

  it('replaces tags only after every assignment resolves to an owned entry', async () => {
    const entries = [
      { id: 1, tags: ['old'] },
      { id: 2, tags: ['keep'] },
    ];
    repository.find.mockResolvedValue(entries);

    await expect(
      service.applyPlan(7, {
        mode: 'replace',
        assignments: [
          { entryId: 1, tags: [' Growth ', 'growth'] },
          { entryId: 2, tags: [] },
        ],
      }),
    ).resolves.toEqual({ success: true, affectedEntries: 2 });
    expect(entries).toEqual([
      { id: 1, tags: ['growth'] },
      { id: 2, tags: [] },
    ]);
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 7 }),
      }),
    );
    expect(repository.save).toHaveBeenCalledWith(entries);
  });

  it('adds suggested themes without discarding existing tags', async () => {
    const entries = [{ id: 1, tags: ['existing', 'Growth'] }];
    repository.find.mockResolvedValue(entries);

    await service.applyPlan(7, {
      mode: 'add',
      assignments: [{ entryId: 1, tags: ['growth', 'New Theme'] }],
    });
    expect(entries[0].tags).toEqual(['existing', 'Growth', 'new-theme']);
  });

  it('rejects empty or partially unavailable plans without saving', async () => {
    await expect(service.applyPlan(7, { mode: 'replace', assignments: [] })).rejects.toThrow(
      BadRequestException,
    );

    repository.find.mockResolvedValue([{ id: 1, tags: [] }]);
    await expect(
      service.applyPlan(7, {
        mode: 'replace',
        assignments: [
          { entryId: 1, tags: ['growth'] },
          { entryId: 99, tags: ['belonging'] },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});

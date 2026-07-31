import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Entry } from '@/database/entities';
import { ConfigService } from '@/modules/config';
import { AiDuplicateService } from './ai-duplicate.service';

describe('AiDuplicateService', () => {
  const entryRepository = { findAndCount: jest.fn() };
  const configService = { getDecryptedConfig: jest.fn() };
  const fetchMock = jest.fn();

  async function createService(apiKey = 'sk-test') {
    process.env.OPENROUTER_API_KEY = apiKey;
    const module = await Test.createTestingModule({
      providers: [
        AiDuplicateService,
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
      ],
    }).compile();
    return module.get(AiDuplicateService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock as never;
    configService.getDecryptedConfig.mockResolvedValue('analysis/model');
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it('returns an empty result without calling AI when fewer than two entries are eligible', async () => {
    entryRepository.findAndCount.mockResolvedValue([
      [{ id: 1, date: '2026-01-01', index: 1, diaryId: 4, content: 'Only entry', tags: [] }],
      1,
    ]);
    const service = await createService('');

    await expect(service.findDuplicates(7, { diaryId: 4 })).resolves.toEqual({
      analyzedEntries: 1,
      totalEntries: 1,
      truncated: false,
      groups: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires OpenRouter when a scan has enough entries', async () => {
    entryRepository.findAndCount.mockResolvedValue([[{ content: 'One' }, { content: 'Two' }], 2]);
    const service = await createService('');

    await expect(service.findDuplicates(7, {})).rejects.toThrow(BadRequestException);
  });

  it('returns bounded owned entry previews for parsed duplicate groups', async () => {
    entryRepository.findAndCount.mockResolvedValue([[{
      id: 11,
      date: '2026-01-01',
      index: 1,
      diaryId: 4,
      content: 'A'.repeat(500),
      tags: ['career'],
    }, {
      id: 12,
      date: '2026-01-02',
      index: 2,
      diaryId: 4,
      content: 'Same career decision',
      tags: ['career'],
    }], 45]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          groups: [{ entryIds: [11, 12], confidence: 92, reason: 'Same decision and outcome.' }],
        }) } }],
      }),
    });
    const service = await createService();

    const result = await service.findDuplicates(7, { diaryId: 4 });

    expect(entryRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 7, diaryId: 4 },
      take: 40,
    }));
    expect(configService.getDecryptedConfig).toHaveBeenCalledWith(7, 'openRouterToneModel');
    expect(result.analyzedEntries).toBe(2);
    expect(result.totalEntries).toBe(45);
    expect(result.truncated).toBe(true);
    expect(result.groups[0]).toEqual(expect.objectContaining({
      confidence: 92,
      reason: 'Same decision and outcome.',
    }));
    expect(result.groups[0].entries[0].content).toHaveLength(400);
  });
});

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Entry } from '@/database/entities';
import { AiSemanticSearchService } from './ai-semantic-search.service';

describe('AiSemanticSearchService', () => {
  const entryRepository = { findAndCount: jest.fn() };
  const fetchMock = jest.fn();

  async function createService(apiKey = 'sk-test', model = 'embedding/model') {
    process.env.OPENROUTER_API_KEY = apiKey;
    process.env.OPENROUTER_EMBEDDING_MODEL = model;
    const module = await Test.createTestingModule({
      providers: [
        AiSemanticSearchService,
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
      ],
    }).compile();
    return module.get(AiSemanticSearchService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock as never;
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_EMBEDDING_MODEL;
  });

  it('returns no matches without calling AI when the journal has no eligible entries', async () => {
    entryRepository.findAndCount.mockResolvedValue([[], 0]);
    const service = await createService('');

    await expect(service.search(7, { query: 'career changes', diaryId: 4 })).resolves.toEqual({
      analyzedEntries: 0,
      totalEntries: 0,
      truncated: false,
      matches: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires OpenRouter when entries need embedding', async () => {
    entryRepository.findAndCount.mockResolvedValue([[
      { id: 11, content: 'A decision', tags: [] },
    ], 1]);
    const service = await createService('');

    await expect(service.search(7, { query: 'career changes' })).rejects.toThrow(BadRequestException);
  });

  it('searches only loaded owned entries and returns relevance-ranked IDs', async () => {
    entryRepository.findAndCount.mockResolvedValue([[
      { id: 11, content: 'A'.repeat(1300), tags: ['career'] },
      { id: 12, content: 'A quiet weekend', tags: ['rest'] },
    ], 140]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          { index: 2, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
          { index: 1, embedding: [0.9, 0.1] },
        ],
      }),
    });
    const service = await createService();

    const result = await service.search(7, { query: 'changing careers', diaryId: 4 });

    expect(entryRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 7, diaryId: 4 },
      take: 100,
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.model).toBe('embedding/model');
    expect(requestBody.input[0]).toBe('changing careers');
    expect(requestBody.input[1].split('\n')[1]).toHaveLength(1200);
    expect(result).toEqual({
      analyzedEntries: 2,
      totalEntries: 140,
      truncated: true,
      matches: [
        { entryId: 11, score: 0.9939 },
        { entryId: 12, score: 0 },
      ],
    });
  });
});

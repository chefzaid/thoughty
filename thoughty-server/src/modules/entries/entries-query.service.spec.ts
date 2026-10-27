import { NotFoundException } from '@nestjs/common';
import { EntriesQueryService } from './entries-query.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntriesQueryService', () => {
  let service: EntriesQueryService;
  let entryRepository: Record<string, jest.Mock>;
  let revisionRepository: Record<string, jest.Mock>;
  let entrySearch: Record<string, jest.Mock>;

  beforeEach(() => {
    entryRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn(),
    };

    revisionRepository = {
      find: jest.fn(),
    };

    entrySearch = {
      prepare: jest.fn().mockResolvedValue({
        kind: 'text',
        text: 'work',
        matchQuery: "'work':*",
        exactQuery: "'work'",
        terms: [{ text: 'work', prefix: true }],
      }),
      findMatches: jest.fn().mockResolvedValue(new Map([[1, ['Work']]])),
    };

    service = new EntriesQueryService(
      entryRepository as never,
      revisionRepository as never,
      entrySearch as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns filtered entries, total pages, and tag metadata', async () => {
    const entriesQb = createQueryBuilder();
    const tagsQb = createQueryBuilder();
    const entry = {
      id: 1,
      userId: 4,
      diaryId: 8,
      date: '2024-01-15',
      index: 1,
      title: 'Planning day',
      timeOfDay: '08:30',
      mood: 4,
      feelings: ['focused'],
      tags: ['work'],
      content: 'First entry',
      format: 'markdown',
      visibility: 'public',
      isFavorite: true,
      isArchived: false,
      isPinned: true,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      diary: { name: 'Work', icon: '💼', color: '#123456' },
      attachments: [
        {
          id: 12,
          originalFilename: 'a.txt',
          storedFilename: 'file-1',
          mimetype: 'text/plain',
          size: 50,
          transcript: 'Stored words',
          transcribedAt: new Date('2024-01-15T10:05:00Z'),
        },
      ],
    };

    entriesQb.getCount.mockResolvedValue(12);
    entriesQb.getMany.mockResolvedValue([entry]);
    tagsQb.getRawMany.mockResolvedValue([{ tag: 'work' }, { tag: 'alpha' }]);
    entryRepository.createQueryBuilder.mockReturnValueOnce(entriesQb).mockReturnValueOnce(tagsQb);

    const result = await service.getEntries(4, {
      search: 'work',
      tags: 'work, focus',
      date: '2024-01-15',
      visibility: 'public',
      favorites: true,
      archiveStatus: 'active',
      diaryId: 8,
      page: 2,
      limit: 5,
    });

    expect(entrySearch.prepare).toHaveBeenCalledWith('work');
    expect(entriesQb.andWhere).toHaveBeenCalledWith(
      '(e.search_vector @@ CAST(:searchQuery AS tsquery) OR e.tags @> :searchTags)',
      { searchQuery: "'work':*", searchTags: ['work'] },
    );
    expect(entriesQb.addSelect).toHaveBeenCalledWith(
      'ts_rank(e.search_vector, CAST(:searchQuery AS tsquery), 1) + ts_rank(e.search_vector, CAST(:exactQuery AS tsquery), 1)',
      'search_rank',
    );
    expect(entriesQb.setParameter).toHaveBeenCalledWith('exactQuery', "'work'");
    expect(entrySearch.findMatches).toHaveBeenCalledWith(4, [1], [{ text: 'work', prefix: true }]);
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.tags @> :tagList', {
      tagList: ['work', 'focus'],
    });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.date = :date', { date: '2024-01-15' });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', {
      visibility: 'public',
    });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 8 });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.is_favorite = true');
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.is_archived = false');
    expect(entriesQb.orderBy).toHaveBeenCalledWith('search_rank', 'DESC');
    expect(entriesQb.addOrderBy).toHaveBeenCalledWith('e.date', 'DESC');
    expect(entriesQb.addOrderBy).toHaveBeenCalledWith('e.timeOfDay', 'ASC', 'NULLS FIRST');
    expect(entriesQb.addOrderBy).toHaveBeenCalledWith('e.index', 'ASC');
    expect(entriesQb.skip).toHaveBeenCalledWith(5);
    expect(entriesQb.take).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      entries: [
        {
          id: 1,
          user_id: 4,
          diary_id: 8,
          date: '2024-01-15',
          index: 1,
          title: 'Planning day',
          time_of_day: '08:30',
          mood: 4,
          feelings: ['focused'],
          tags: ['work'],
          content: 'First entry',
          format: 'markdown',
          visibility: 'public',
          is_favorite: true,
          is_archived: false,
          is_pinned: true,
          diary_name: 'Work',
          diary_icon: '💼',
          diary_color: '#123456',
          created_at: entry.createdAt,
          attachments: [
            {
              id: 12,
              original_filename: 'a.txt',
              stored_filename: 'file-1',
              mimetype: 'text/plain',
              size: 50,
              transcript: 'Stored words',
              transcribed_at: new Date('2024-01-15T10:05:00Z'),
            },
          ],
          search_matches: ['Work'],
        },
      ],
      total: 12,
      page: 2,
      totalPages: 3,
      allTags: ['alpha', 'work'],
    });
  });

  it.each([
    ['4,5', 'e.mood IN (:...moods)', { moods: [4, 5] }],
    ['2,2', 'e.mood IN (:...moods)', { moods: [2] }],
    ['any', 'e.mood IS NOT NULL', undefined],
    ['none', 'e.mood IS NULL', undefined],
  ])('filters the journal by the mood %p', async (mood, condition, parameters) => {
    const entriesQb = createQueryBuilder();
    entriesQb.getCount.mockResolvedValue(0);
    entriesQb.getMany.mockResolvedValue([]);
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(entriesQb)
      .mockReturnValueOnce(createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }));

    await service.getEntries(4, { mood });

    expect(entriesQb.andWhere).toHaveBeenCalledWith(...(parameters ? [condition, parameters] : [condition]));
  });

  it('filters the journal by a life era of the entry owner', async () => {
    const entriesQb = createQueryBuilder();
    entriesQb.getCount.mockResolvedValue(0);
    entriesQb.getMany.mockResolvedValue([]);
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(entriesQb)
      .mockReturnValueOnce(createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }));

    await service.getEntries(4, { eraId: 3 });

    expect(entriesQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('FROM life_eras era WHERE era.id = :eraId AND era.user_id = e.user_id'), { eraId: 3 });
    expect(entriesQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('(era.end_date IS NULL OR e.date <= era.end_date)'), { eraId: 3 });
  });

  it('filters the journal to the entries that mention a person', async () => {
    const entriesQb = createQueryBuilder();
    entriesQb.getCount.mockResolvedValue(0);
    entriesQb.getMany.mockResolvedValue([]);
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(entriesQb)
      .mockReturnValueOnce(createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }));

    await service.getEntries(4, { personId: 12 });

    expect(entriesQb.andWhere).toHaveBeenCalledWith(
      'EXISTS (SELECT 1 FROM entry_people ep WHERE ep.entry_id = e.id AND ep.person_id = :personId)',
      { personId: 12 },
    );
  });

  it('keeps date order for a search when asked, pinned entries first', async () => {
    const entriesQb = createQueryBuilder();
    entriesQb.getCount.mockResolvedValue(0);
    entriesQb.getMany.mockResolvedValue([]);
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(entriesQb)
      .mockReturnValueOnce(createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }));

    const result = await service.getEntries(4, { search: 'work', sort: 'date' });

    expect(entriesQb.orderBy).toHaveBeenCalledWith('e.isPinned', 'DESC');
    expect(entriesQb.orderBy).not.toHaveBeenCalledWith('search_rank', 'DESC');
    expect(result.entries).toEqual([]);
  });

  it('matches searches without words literally, with LIKE wildcards escaped', async () => {
    entrySearch.prepare.mockResolvedValue({ kind: 'literal', text: '100%_🎉' });
    const entriesQb = createQueryBuilder();
    entriesQb.getCount.mockResolvedValue(1);
    entriesQb.getMany.mockResolvedValue([{ id: 9, content: '100%_🎉', tags: [], attachments: [] }]);
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(entriesQb)
      .mockReturnValueOnce(createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }));

    const result = await service.getEntries(4, { search: '100%_🎉' });

    expect(entriesQb.andWhere).toHaveBeenCalledWith(
      '(e.content ILIKE :searchPattern OR e.title ILIKE :searchPattern OR e.tags @> :searchTags)',
      { searchPattern: String.raw`%100\%\_🎉%`, searchTags: ['100%_🎉'] },
    );
    expect(entriesQb.orderBy).toHaveBeenCalledWith('e.isPinned', 'DESC');
    expect(entrySearch.findMatches).not.toHaveBeenCalled();
    expect(result.entries[0]).not.toHaveProperty('search_matches');
  });

  it('returns available dates ordered descending', async () => {
    const qb = createQueryBuilder({
      getRawMany: jest.fn().mockResolvedValue([{ date: '2024-01-15' }, { date: '2024-01-10' }]),
    });
    entryRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(service.getDates(2)).resolves.toEqual({ dates: ['2024-01-15', '2024-01-10'] });
    expect(qb.select).toHaveBeenCalledWith("DISTINCT TO_CHAR(e.date, 'YYYY-MM-DD')", 'date');
  });

  it('limits results to owned semantic IDs and preserves relevance order', async () => {
    const entriesQb = createQueryBuilder({
      getCount: jest.fn().mockResolvedValue(2),
      getMany: jest.fn().mockResolvedValue([]),
    });
    const tagsQb = createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) });
    entryRepository.createQueryBuilder.mockReturnValueOnce(entriesQb).mockReturnValueOnce(tagsQb);

    await service.getEntries(4, { ids: '8,3,8', page: 1, limit: 10 });

    expect(entriesQb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.id IN (:...entryIds)', {
      entryIds: [8, 3],
    });
    expect(entriesQb.addSelect).toHaveBeenCalledWith(
      'array_position(CAST(:semanticOrder AS integer[]), e.id)',
      'semantic_rank',
    );
    expect(entriesQb.setParameter).toHaveBeenCalledWith('semanticOrder', [8, 3]);
    expect(entriesQb.orderBy).toHaveBeenCalledWith('semantic_rank', 'ASC');
  });

  it('returns random and on-this-day highlights grouped by years ago', async () => {
    const diary = { name: 'Travel', icon: '✈️', color: '#2A9D8F' };
    const randomQb = createQueryBuilder({ getOne: jest.fn().mockResolvedValue({ id: 99, isFavorite: true, diary }) });
    const onThisDayQb = createQueryBuilder({
      getRawAndEntities: jest.fn().mockResolvedValue({
        raw: [{ entry_year: '2023' }, { entry_year: '2022' }],
        entities: [{ id: 1, diary }, { id: 2, diary: null }],
      }),
    });
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(randomQb)
      .mockReturnValueOnce(onThisDayQb);

    const realDate = Date;
    global.Date = class extends Date {
      constructor(value?: string | number | Date) {
        super(value ?? '2024-01-15T12:00:00Z');
      }
      static override now() {
        return new realDate('2024-01-15T12:00:00Z').valueOf();
      }
    } as DateConstructor;

    const result = await service.getHighlights(7, { diaryId: 3 });

    global.Date = realDate;

    expect(randomQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    expect(onThisDayQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    // Sent like every other entry: snake_case, with the diary the web shows on each card
    expect(result.randomEntry).toEqual(
      expect.objectContaining({ id: 99, is_favorite: true, diary_name: 'Travel', diary_icon: '✈️', diary_color: '#2A9D8F' }),
    );
    expect(result.randomEntry).not.toHaveProperty('diary');
    expect(result.onThisDay).toEqual({
      1: [expect.objectContaining({ id: 1, diary_name: 'Travel' })],
      2: [expect.objectContaining({ id: 2, diary_name: undefined })],
    });
    expect(result.currentDate).toEqual({ month: '01', day: '15', year: 2024 });
  });

  it('answers no random entry and no earlier years when the journal is empty', async () => {
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }))
      .mockReturnValueOnce(createQueryBuilder({ getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }) }));

    const result = await service.getHighlights(7, {});

    expect(result.randomEntry).toBeNull();
    expect(result.onThisDay).toEqual({});
  });

  it('returns revisions ordered by date and throws when the entry is missing', async () => {
    entryRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 8, userId: 2 });
    revisionRepository.find.mockResolvedValue([{ id: 5 }]);

    await expect(service.getRevisions(2, 8)).rejects.toThrow(NotFoundException);
    await expect(service.getRevisions(2, 8)).resolves.toEqual([{ id: 5 }]);
    expect(revisionRepository.find).toHaveBeenCalledWith({
      where: { entryId: 8, userId: 2 },
      order: { createdAt: 'DESC' },
    });
  });

  it('lists user-scoped tag usage counts outside the recycle bin', async () => {
    entryRepository.query.mockResolvedValue([
      { tag: 'focus', count: '3' },
      { tag: 'work', count: 1 },
    ]);

    await expect(service.getTagUsage(4)).resolves.toEqual({
      tags: [
        { tag: 'focus', count: 3 },
        { tag: 'work', count: 1 },
      ],
    });
    expect(entryRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.user_id = $1 AND e.deleted_at IS NULL'),
      [4],
    );
  });
});

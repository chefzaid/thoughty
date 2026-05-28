import { NotFoundException } from '@nestjs/common';
import { EntriesQueryService } from './entries-query.service';

function createQueryBuilder(overrides: Record<string, unknown> = {}) {
  const qb: Record<string, jest.Mock> = {
    addOrderBy: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getRawAndEntities: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    leftJoinAndSelect: jest.fn(() => qb),
    limit: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    select: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    where: jest.fn(() => qb),
  };

  Object.assign(qb, overrides);
  return qb;
}

describe('EntriesQueryService', () => {
  let service: EntriesQueryService;
  let entryRepository: Record<string, jest.Mock>;
  let revisionRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    entryRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };

    revisionRepository = {
      find: jest.fn(),
    };

    service = new EntriesQueryService(entryRepository as never, revisionRepository as never);
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
      tags: ['work'],
      content: 'First entry',
      format: 'markdown',
      visibility: 'public',
      isFavorite: true,
      isArchived: false,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      diary: { name: 'Work', icon: '💼', color: '#123456' },
      attachments: [{
        id: 12,
        originalFilename: 'a.txt',
        storedFilename: 'file-1',
        mimetype: 'text/plain',
        size: 50,
      }],
    };

    entriesQb.getCount.mockResolvedValue(12);
    entriesQb.getMany.mockResolvedValue([entry]);
    tagsQb.getRawMany.mockResolvedValue([{ tag: 'work' }, { tag: 'alpha' }]);
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(entriesQb)
      .mockReturnValueOnce(tagsQb);

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

    expect(entriesQb.andWhere).toHaveBeenCalledWith('(e.content ILIKE :search OR :searchTerm = ANY(e.tags))', {
      search: '%work%',
      searchTerm: 'work',
    });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.tags @> :tagList', { tagList: ['work', 'focus'] });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.date = :date', { date: '2024-01-15' });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', { visibility: 'public' });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 8 });
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.is_favorite = true');
    expect(entriesQb.andWhere).toHaveBeenCalledWith('e.is_archived = false');
    expect(entriesQb.skip).toHaveBeenCalledWith(5);
    expect(entriesQb.take).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      entries: [{
        id: 1,
        user_id: 4,
        diary_id: 8,
        date: '2024-01-15',
        index: 1,
        tags: ['work'],
        content: 'First entry',
        format: 'markdown',
        visibility: 'public',
        is_favorite: true,
        is_archived: false,
        diary_name: 'Work',
        diary_icon: '💼',
        diary_color: '#123456',
        created_at: entry.createdAt,
        attachments: [{
          id: 12,
          original_filename: 'a.txt',
          stored_filename: 'file-1',
          mimetype: 'text/plain',
          size: 50,
        }],
      }],
      total: 12,
      page: 2,
      totalPages: 3,
      allTags: ['alpha', 'work'],
    });
  });

  it('returns available dates ordered descending', async () => {
    const qb = createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([{ date: '2024-01-15' }, { date: '2024-01-10' }]) });
    entryRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(service.getDates(2)).resolves.toEqual({ dates: ['2024-01-15', '2024-01-10'] });
    expect(qb.select).toHaveBeenCalledWith("DISTINCT TO_CHAR(e.date, 'YYYY-MM-DD')", 'date');
  });

  it('returns available years and months without selecting an entry when year is missing', async () => {
    const yearsQb = createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([{ year: '2024' }, { year: '2023' }]) });
    const monthsQb = createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([{ month: '2024-01' }]) });
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(yearsQb)
      .mockReturnValueOnce(monthsQb);

    await expect(service.getFirstEntry(1, { limit: 10 })).resolves.toEqual({
      page: 1,
      found: false,
      years: [2024, 2023],
      months: ['2024-01'],
    });
  });

  it('finds the first entry for a year-month selection and returns the containing page', async () => {
    const yearsQb = createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([{ year: '2024' }]) });
    const monthsQb = createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([{ month: '2024-01' }, { month: '2024-02' }]) });
    const firstDateQb = createQueryBuilder({ getRawOne: jest.fn().mockResolvedValue({ first_date: '2024-02-03' }) });
    const firstIdQb = createQueryBuilder({ getRawOne: jest.fn().mockResolvedValue({ e_id: 44 }) });
    const countQb = createQueryBuilder({ getCount: jest.fn().mockResolvedValue(13) });

    entryRepository.createQueryBuilder
      .mockReturnValueOnce(yearsQb)
      .mockReturnValueOnce(monthsQb)
      .mockReturnValueOnce(firstDateQb)
      .mockReturnValueOnce(firstIdQb)
      .mockReturnValueOnce(countQb);

    const result = await service.getFirstEntry(5, { year: 2024, month: 2, limit: 10 });

    expect(firstDateQb.andWhere).toHaveBeenCalledWith("TO_CHAR(e.date, 'YYYY-MM') = :dateFilter", {
      dateFilter: '2024-02',
    });
    expect(firstIdQb.andWhere).toHaveBeenCalledWith("TO_CHAR(e.date, 'YYYY-MM') = :dateFilter", {
      dateFilter: '2024-02',
    });
    expect(result).toEqual({
      page: 2,
      found: true,
      entryId: 44,
      years: [2024],
      months: ['2024-01', '2024-02'],
    });
  });

  it('navigates to an entry by explicit id and returns the containing page', async () => {
    entryRepository.findOne.mockResolvedValue({ id: 7, userId: 3, date: '2024-01-20', index: 4 });
    const newerQb = createQueryBuilder({ getCount: jest.fn().mockResolvedValue(14) });
    const sameDayQb = createQueryBuilder({ getCount: jest.fn().mockResolvedValue(2) });
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(newerQb)
      .mockReturnValueOnce(sameDayQb);

    const result = await service.getEntryByDate(3, { id: 7, limit: 10 });

    expect(entryRepository.findOne).toHaveBeenCalledWith({ where: { userId: 3, id: 7 } });
    expect(result).toEqual({
      found: true,
      entry: { id: 7, userId: 3, date: '2024-01-20', index: 4 },
      page: 2,
      entryId: 7,
    });
  });

  it('returns validation and not-found errors when navigating by date without a match', async () => {
    await expect(service.getEntryByDate(1, { index: 1 })).resolves.toEqual({ found: false, error: 'Date is required' });

    entryRepository.findOne.mockResolvedValue(null);
    await expect(service.getEntryByDate(1, { date: '2024-01-10', index: 2 })).resolves.toEqual({
      found: false,
      error: 'Entry not found',
    });
  });

  it('returns random and on-this-day highlights grouped by years ago', async () => {
    const randomQb = createQueryBuilder({ getOne: jest.fn().mockResolvedValue({ id: 99 }) });
    const onThisDayQb = createQueryBuilder({
      getRawAndEntities: jest.fn().mockResolvedValue({
        raw: [{ entry_year: '2023' }, { entry_year: '2022' }],
        entities: [{ id: 1 }, { id: 2 }],
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
    expect(result.randomEntry).toEqual({ id: 99 });
    expect(result.onThisDay).toEqual({ 1: [{ id: 1 }], 2: [{ id: 2 }] });
    expect(result.currentDate).toEqual({ month: '01', day: '15', year: 2024 });
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
});
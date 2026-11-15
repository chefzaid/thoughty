import { NotFoundException } from '@nestjs/common';
import { EntryLookupService } from './entry-lookup.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryLookupService', () => {
  let service: EntryLookupService;
  let entryRepository: Record<string, jest.Mock>;
  let entrySearch: { prepare: jest.Mock };

  beforeEach(() => {
    entryRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };

    entrySearch = { prepare: jest.fn().mockResolvedValue({ kind: 'literal', text: 'walk' }) };
    service = new EntryLookupService(entryRepository as never, entrySearch as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns available years and months without selecting an entry when year is missing', async () => {
    const yearsQb = createQueryBuilder({
      getRawMany: jest.fn().mockResolvedValue([{ year: '2024' }, { year: '2023' }]),
    });
    const monthsQb = createQueryBuilder({
      getRawMany: jest.fn().mockResolvedValue([{ month: '2024-01' }]),
    });
    entryRepository.createQueryBuilder.mockReturnValueOnce(yearsQb).mockReturnValueOnce(monthsQb);

    await expect(service.getFirstEntry(1, {})).resolves.toEqual({
      found: false,
      years: [2024, 2023],
      months: ['2024-01'],
    });
  });

  it('finds the first entry of a month among the journal filters', async () => {
    const yearsQb = createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([{ year: '2024' }]) });
    const monthsQb = createQueryBuilder({
      getRawMany: jest.fn().mockResolvedValue([{ month: '2024-01' }, { month: '2024-02' }]),
    });
    const firstIdQb = createQueryBuilder({ getRawOne: jest.fn().mockResolvedValue({ e_id: 44 }) });
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(yearsQb)
      .mockReturnValueOnce(monthsQb)
      .mockReturnValueOnce(firstIdQb);

    const result = await service.getFirstEntry(5, { year: 2024, month: 2, diaryId: 3, search: 'walk' });

    expect(entrySearch.prepare).toHaveBeenCalledWith('walk');
    expect(firstIdQb.orderBy).toHaveBeenCalledWith('e.date', 'ASC');
    expect(firstIdQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    expect(firstIdQb.andWhere).toHaveBeenCalledWith('e.date >= :monthStart AND e.date < :nextMonthStart', {
      monthStart: '2024-02-01',
      nextMonthStart: '2024-03-01',
    });
    expect(result).toEqual({ found: true, entryId: 44, years: [2024], months: ['2024-01', '2024-02'] });
  });

  it('finds the first entry of a year, or none when the filters leave every entry of it out', async () => {
    const lists = () => [
      createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([{ year: '2024' }]) }),
      createQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([{ month: '2024-01' }]) }),
    ];
    const firstIdQb = createQueryBuilder({ getRawOne: jest.fn().mockResolvedValue(undefined) });
    entryRepository.createQueryBuilder.mockReturnValueOnce(lists()[0]).mockReturnValueOnce(lists()[1]).mockReturnValueOnce(firstIdQb);

    await expect(service.getFirstEntry(5, { year: 2024, favorites: true })).resolves.toEqual({
      found: false,
      years: [2024],
      months: ['2024-01'],
    });
    expect(entrySearch.prepare).not.toHaveBeenCalled();
    expect(firstIdQb.andWhere).toHaveBeenCalledWith('EXTRACT(YEAR FROM e.date) = :year', { year: 2024 });
    expect(firstIdQb.andWhere).toHaveBeenCalledWith('e.is_favorite = true');
  });

  it('finds an entry by explicit id', async () => {
    entryRepository.findOne.mockResolvedValue({ id: 7, userId: 3, date: '2024-01-20', index: 4 });

    const result = await service.getEntryByDate(3, { id: 7 });

    expect(entryRepository.findOne).toHaveBeenCalledWith({ where: { userId: 3, id: 7 } });
    expect(result).toEqual({
      found: true,
      entry: { id: 7, userId: 3, date: '2024-01-20', index: 4 },
      entryId: 7,
    });
  });

  it('returns validation and not-found errors when navigating by date without a match', async () => {
    await expect(service.getEntryByDate(1, { index: 1 })).resolves.toEqual({
      found: false,
      error: 'Date is required',
    });

    entryRepository.findOne.mockResolvedValue(null);
    await expect(service.getEntryByDate(1, { date: '2024-01-10', index: 2 })).resolves.toEqual({
      found: false,
      error: 'Entry not found',
    });
  });

  it('returns exact backlinks for the target entry date and index', async () => {
    entryRepository.findOne.mockResolvedValue({ id: 7, userId: 3, date: '2024-01-20', index: 2 });
    const matchingEntry = {
      id: 12,
      userId: 3,
      date: '2024-02-01',
      index: 1,
      tags: ['research'],
      content: 'This references [[2024-01-20#2]] directly.',
      format: 'markdown',
      visibility: 'private',
      isFavorite: false,
      isArchived: false,
      isPinned: false,
      diary: { name: 'Work', icon: 'W', color: '#123456' },
    };
    const legacyMatch = {
      ...matchingEntry,
      id: 13,
      content: 'Legacy reference entry (2024-01-20--2).',
    };
    const wrongIndex = {
      ...matchingEntry,
      id: 14,
      content: 'This references [[2024-01-20]] only.',
    };
    const backlinksQb = createQueryBuilder({
      getMany: jest.fn().mockResolvedValue([matchingEntry, legacyMatch, wrongIndex]),
    });
    entryRepository.createQueryBuilder.mockReturnValue(backlinksQb);

    const result = await service.getBacklinks(3, 7);

    expect(entryRepository.findOne).toHaveBeenCalledWith({ where: { id: 7, userId: 3 } });
    expect(backlinksQb.andWhere).toHaveBeenCalledWith('e.id != :entryId', { entryId: 7 });
    expect(backlinksQb.andWhere).toHaveBeenCalledWith('e.content ILIKE :targetDate', {
      targetDate: '%2024-01-20%',
    });
    expect(result).toEqual({
      backlinks: [
        {
          id: 12,
          date: '2024-02-01',
          index: 1,
          title: null,
          time_of_day: null,
          tags: ['research'],
          content: 'This references [[2024-01-20#2]] directly.',
          format: 'markdown',
          visibility: 'private',
          is_favorite: false,
          is_archived: false,
          is_pinned: false,
          diary_name: 'Work',
          diary_icon: 'W',
          diary_color: '#123456',
        },
        {
          id: 13,
          date: '2024-02-01',
          index: 1,
          title: null,
          time_of_day: null,
          tags: ['research'],
          content: 'Legacy reference entry (2024-01-20--2).',
          format: 'markdown',
          visibility: 'private',
          is_favorite: false,
          is_archived: false,
          is_pinned: false,
          diary_name: 'Work',
          diary_icon: 'W',
          diary_color: '#123456',
        },
      ],
    });
  });

  it('throws when fetching backlinks for a missing entry', async () => {
    entryRepository.findOne.mockResolvedValue(null);

    await expect(service.getBacklinks(3, 999)).rejects.toThrow(NotFoundException);
  });
});

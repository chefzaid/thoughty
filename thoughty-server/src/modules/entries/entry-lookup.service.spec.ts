import { NotFoundException } from '@nestjs/common';
import { EntryLookupService } from './entry-lookup.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryLookupService', () => {
  let service: EntryLookupService;
  let entryRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    entryRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };

    service = new EntryLookupService(entryRepository as never);
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

    await expect(service.getFirstEntry(1, { limit: 10 })).resolves.toEqual({
      page: 1,
      found: false,
      years: [2024, 2023],
      months: ['2024-01'],
    });
  });

  it('finds the first entry for a year-month selection and returns the containing page', async () => {
    const yearsQb = createQueryBuilder({
      getRawMany: jest.fn().mockResolvedValue([{ year: '2024' }]),
    });
    const monthsQb = createQueryBuilder({
      getRawMany: jest.fn().mockResolvedValue([{ month: '2024-01' }, { month: '2024-02' }]),
    });
    const firstDateQb = createQueryBuilder({
      getRawOne: jest.fn().mockResolvedValue({ first_date: '2024-02-03' }),
    });
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
    const countBeforeQb = createQueryBuilder({ getCount: jest.fn().mockResolvedValue(16) });
    entryRepository.createQueryBuilder.mockReturnValueOnce(countBeforeQb);

    const result = await service.getEntryByDate(3, { id: 7, limit: 10 });

    expect(entryRepository.findOne).toHaveBeenCalledWith({ where: { userId: 3, id: 7 } });
    expect(countBeforeQb.andWhere).toHaveBeenCalledWith(
      "(e.is_pinned = true OR (e.is_pinned = false AND (e.date > :date OR (e.date = :date AND (e.time_of_day IS NOT NULL, COALESCE(e.time_of_day, TIME '00:00'), e.index) < (CAST(:hasTime AS boolean), COALESCE(CAST(:timeOfDay AS time), TIME '00:00'), CAST(:index AS integer))))))",
      { date: '2024-01-20', hasTime: false, timeOfDay: null, index: 4 },
    );
    expect(result).toEqual({
      found: true,
      entry: { id: 7, userId: 3, date: '2024-01-20', index: 4 },
      page: 2,
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

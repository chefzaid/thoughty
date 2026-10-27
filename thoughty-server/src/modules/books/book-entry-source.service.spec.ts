import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { apiError } from '@/common/errors';
import { BookEntrySourceService, bookScopeKey, parsePickedEntryIds } from './book-entry-source.service';
import { MAX_PICKED_BOOK_ENTRIES } from './dto';

describe('BookEntrySourceService', () => {
  let queryBuilder: Record<string, jest.Mock>;
  let entryRepository: { createQueryBuilder: jest.Mock };
  let diaryRepository: { findOne: jest.Mock };
  let savedSearches: { findOwn: jest.Mock };
  let entrySearch: { prepare: jest.Mock };
  let service: BookEntrySourceService;

  const savedSearch = (filters: Record<string, unknown> = {}) => ({
    id: 4,
    name: 'Family',
    diaryId: 2,
    filters: {
      search: '',
      searchMode: 'keyword',
      sort: 'relevance',
      tags: ['family', 'home'],
      date: null,
      visibility: 'all',
      archiveStatus: 'all',
      favorites: false,
      mood: '',
      ...filters,
    },
  });

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    entryRepository = { createQueryBuilder: jest.fn(() => queryBuilder) };
    diaryRepository = { findOne: jest.fn().mockResolvedValue({ id: 2, name: 'Home' }) };
    savedSearches = { findOwn: jest.fn().mockResolvedValue(savedSearch()) };
    entrySearch = { prepare: jest.fn().mockResolvedValue({ kind: 'literal', text: '🌊' }) };
    service = new BookEntrySourceService(
      entryRepository as never,
      diaryRepository as never,
      savedSearches as never,
      entrySearch as never,
    );
  });

  const conditions = () => queryBuilder.andWhere.mock.calls.map(([condition]) => condition as string);

  describe('journal', () => {
    it('reads the diary’s active entries in date order and takes its name as the default title', async () => {
      const selection = await service.select(7, { diaryId: 2, dateFrom: '2024-01-01' });

      expect(queryBuilder.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
      expect(conditions()).toEqual(['e.sealed_until IS NULL', 'e.is_archived = false', 'e.diary_id = :diaryId', 'e.date >= :dateFrom']);
      expect(selection).toEqual({ entries: [], source: { kind: 'journal', diaryId: 2 }, defaultTitle: 'Home' });
    });
  });

  describe('saved search', () => {
    it('applies the stored filters, scoped to the search’s diary, and takes its name as the default title', async () => {
      savedSearches.findOwn.mockResolvedValue(savedSearch({ favorites: true, mood: '4,5', date: '2024-05-01' }));
      const entries = [{ id: 1 }];
      queryBuilder.getMany.mockResolvedValue(entries);

      const selection = await service.select(7, { source: 'savedSearch', savedSearchId: 4 });

      expect(savedSearches.findOwn).toHaveBeenCalledWith(7, 4);
      expect(entrySearch.prepare).not.toHaveBeenCalled();
      expect(conditions()).toEqual([
        'e.sealed_until IS NULL',
        'e.tags @> :tagList',
        'e.diary_id = :diaryId',
        'e.is_favorite = true',
        'e.mood IN (:...moods)',
        'e.date = :date',
      ]);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 2 });
      expect(selection).toEqual({
        entries,
        source: { kind: 'savedSearch', savedSearchId: 4, savedSearchName: 'Family' },
        defaultTitle: 'Family',
      });
    });

    it('matches the search text as the journal does, and leaves archived entries out when the search does', async () => {
      savedSearches.findOwn.mockResolvedValue(savedSearch({ search: ' 🌊 ', archiveStatus: 'active', tags: [] }));

      await service.select(7, { source: 'savedSearch', savedSearchId: 4 });

      expect(entrySearch.prepare).toHaveBeenCalledWith('🌊');
      expect(conditions()).toContain('(e.content ILIKE :searchPattern OR e.title ILIKE :searchPattern OR e.tags @> :searchTags)');
      expect(conditions()).toContain('e.is_archived = false');
    });

    it('refuses a meaning search, a missing search, and another writer’s search', async () => {
      savedSearches.findOwn.mockResolvedValueOnce(savedSearch({ search: 'calm', searchMode: 'semantic' }));
      await expectApiError(service.select(7, { source: 'savedSearch', savedSearchId: 4 }), BadRequestException, 'BOOK_SAVED_SEARCH_SEMANTIC');

      await expectApiError(service.select(7, { source: 'savedSearch' }), BadRequestException, 'BOOK_SAVED_SEARCH_REQUIRED');

      savedSearches.findOwn.mockRejectedValueOnce(apiError(NotFoundException, 'SAVED_SEARCH_NOT_FOUND'));
      await expectApiError(service.select(7, { source: 'savedSearch', savedSearchId: 9 }), NotFoundException, 'SAVED_SEARCH_NOT_FOUND');
      expect(queryBuilder.getMany).not.toHaveBeenCalled();
    });

    it('builds from a meaning search without search text, which filters like the journal', async () => {
      savedSearches.findOwn.mockResolvedValue(savedSearch({ search: '  ', searchMode: 'semantic' }));

      await expect(service.select(7, { source: 'savedSearch', savedSearchId: 4 })).resolves.toEqual(
        expect.objectContaining({ defaultTitle: 'Family' }),
      );
    });
  });

  describe('hand-picked entries', () => {
    it('reads only the writer’s picked entries, archived ones included, with eligible images when asked', async () => {
      queryBuilder.getMany.mockResolvedValue([{ id: 5 }, { id: 3 }]);

      const selection = await service.select(7, { source: 'entries', entryIds: '5,3,5', embedImages: true });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('e.id IN (:...entryIds)', { entryIds: [5, 3] });
      expect(conditions()).not.toContain('e.is_archived = false');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'e.attachments',
        'bookAttachment',
        expect.any(String),
        expect.any(Object),
      );
      expect(selection).toEqual({ entries: [{ id: 5 }, { id: 3 }], source: { kind: 'entries', entryIds: [5, 3] } });
      expect(selection.defaultTitle).toBeUndefined();
    });

    it('refuses picks that are not the writer’s or are in the recycle bin', async () => {
      queryBuilder.getMany.mockResolvedValue([{ id: 5 }]);

      await expectApiError(service.select(7, { source: 'entries', entryIds: '5,6' }), BadRequestException, 'BOOK_PICKED_ENTRIES_UNAVAILABLE');
    });

    it('describes the picked entries and the IDs that are gone', async () => {
      queryBuilder.getMany.mockResolvedValue([
        {
          id: 5,
          date: '2024-05-01',
          title: null,
          content: `**Walked** to the river.\n\n${'Then more. '.repeat(30)}`,
          diaryId: 2,
          diary: { name: 'Home' },
          isArchived: true,
        },
        { id: 3, date: '2024-06-01', title: 'Short', content: 'A line', diaryId: null, diary: null, isArchived: false },
      ]);

      const described = await service.describePickedEntries(7, '3,5,9');

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('e.diary', 'd');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('e.id IN (:...ids)', { ids: [3, 5, 9] });
      expect(described.missingIds).toEqual([9]);
      expect(described.entries[0]).toEqual(expect.objectContaining({
        id: 5, date: '2024-05-01', title: null, diaryName: 'Home', isArchived: true,
      }));
      expect(described.entries[0]!.excerpt).toMatch(/^Walked to the river\. Then more\./);
      expect(described.entries[0]!.excerpt.length).toBeLessThanOrEqual(140);
      expect(described.entries[0]!.excerpt.endsWith('…')).toBe(true);
      expect(described.entries[1]).toEqual(expect.objectContaining({ excerpt: 'A line', diaryId: null, diaryName: null }));
    });
  });

  describe('parsePickedEntryIds', () => {
    it('keeps each ID once, in order, and refuses none or too many', () => {
      expect(parsePickedEntryIds('4,2,4,0')).toEqual([4, 2]);
      expect(() => parsePickedEntryIds('')).toThrow(BadRequestException);
      expect(() => parsePickedEntryIds(undefined)).toThrow(BadRequestException);
      const tooMany = Array.from({ length: MAX_PICKED_BOOK_ENTRIES + 1 }, (_, index) => index + 1).join(',');
      expect(() => parsePickedEntryIds(tooMany)).toThrow('at most 500 picked entries');
    });
  });

  describe('bookScopeKey', () => {
    it('keeps a history per diary, per saved search, and one for hand-picked books', () => {
      expect(bookScopeKey(undefined)).toBe('all');
      expect(bookScopeKey('journal', 3)).toBe('diary:3');
      expect(bookScopeKey('savedSearch', 3, 8)).toBe('search:8');
      expect(bookScopeKey('entries', 3)).toBe('picked');
    });
  });
});

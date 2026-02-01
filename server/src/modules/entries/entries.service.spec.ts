import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EntriesService } from './entries.service';
import { Entry, Diary } from '@/database/entities';

describe('EntriesService', () => {
  let service: EntriesService;
  let entryRepository: any;
  let diaryRepository: any;

  const mockEntry = {
    id: 1,
    userId: 1,
    diaryId: 1,
    date: '2024-01-15',
    index: 1,
    tags: ['tag1', 'tag2'],
    content: 'Test entry content',
    visibility: 'private',
    createdAt: new Date(),
    diary: { id: 1, name: 'Test Diary', icon: '📓' },
  };

  const mockDiary = {
    id: 1,
    userId: 1,
    name: 'Test Diary',
    icon: '📓',
    isDefault: true,
  };

  beforeEach(async () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockEntry]),
      getOne: jest.fn().mockResolvedValue(mockEntry),
      getCount: jest.fn().mockResolvedValue(1),
      getRawMany: jest.fn().mockResolvedValue([{ tag: 'tag1' }, { tag: 'tag2' }]),
      getRawOne: jest.fn().mockResolvedValue({ first_date: '2024-01-15', e_id: 1 }),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: [mockEntry],
        raw: [{ entry_year: '2023' }],
      }),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    entryRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    diaryRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntriesService,
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
      ],
    }).compile();

    service = module.get<EntriesService>(EntriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEntries', () => {
    it('should return paginated entries', async () => {
      const result = await service.getEntries(1, { page: 1, limit: 10 });

      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('totalPages');
      expect(result).toHaveProperty('allTags');
    });

    it('should filter by search term', async () => {
      const result = await service.getEntries(1, { search: 'test', page: 1, limit: 10 });

      expect(result.entries).toBeDefined();
    });

    it('should filter by tags', async () => {
      const result = await service.getEntries(1, { tags: 'tag1,tag2', page: 1, limit: 10 });

      expect(result.entries).toBeDefined();
    });

    it('should filter by date', async () => {
      const result = await service.getEntries(1, { date: '2024-01-15', page: 1, limit: 10 });

      expect(result.entries).toBeDefined();
    });

    it('should filter by visibility', async () => {
      const result = await service.getEntries(1, { visibility: 'private', page: 1, limit: 10 });

      expect(result.entries).toBeDefined();
    });

    it('should filter by diaryId', async () => {
      const result = await service.getEntries(1, { diaryId: 1, page: 1, limit: 10 });

      expect(result.entries).toBeDefined();
    });
  });

  describe('getDates', () => {
    it('should return list of dates', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getRawMany.mockResolvedValue([{ date: '2024-01-15' }, { date: '2024-01-14' }]);

      const result = await service.getDates(1);

      expect(result).toHaveProperty('dates');
      expect(Array.isArray(result.dates)).toBe(true);
    });
  });

  describe('getFirstEntry', () => {
    it('should return first entry info with years and months', async () => {
      const result = await service.getFirstEntry(1, { year: 2024, month: 1, limit: 10 });

      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('found');
      expect(result).toHaveProperty('years');
      expect(result).toHaveProperty('months');
    });

    it('should return page 1 when no year specified', async () => {
      const result = await service.getFirstEntry(1, { limit: 10 });

      expect(result.page).toBe(1);
      expect(result.found).toBe(false);
    });

    it('should return not found when no entry exists', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ first_date: null });

      const result = await service.getFirstEntry(1, { year: 2024, limit: 10 });

      expect(result.found).toBe(false);
    });
  });

  describe('getEntryByDate', () => {
    it('should find entry by date and index', async () => {
      entryRepository.findOne.mockResolvedValue(mockEntry);

      const result = await service.getEntryByDate(1, { date: '2024-01-15', index: 1, limit: 10 });

      expect(result.found).toBe(true);
      expect(result.entry).toBeDefined();
    });

    it('should find entry by id', async () => {
      entryRepository.findOne.mockResolvedValue(mockEntry);

      const result = await service.getEntryByDate(1, { id: 1, limit: 10 });

      expect(result.found).toBe(true);
    });

    it('should return error when date not provided and no id', async () => {
      const result = await service.getEntryByDate(1, { limit: 10 });

      expect(result.found).toBe(false);
      expect(result.error).toBe('Date is required');
    });

    it('should return not found for non-existent entry', async () => {
      entryRepository.findOne.mockResolvedValue(null);

      const result = await service.getEntryByDate(1, { date: '2024-01-15', index: 1, limit: 10 });

      expect(result.found).toBe(false);
      expect(result.error).toBe('Entry not found');
    });
  });

  describe('create', () => {
    it('should create new entry', async () => {
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);

      const result = await service.create(1, {
        tags: ['tag1'],
        text: 'New entry content',
        date: '2024-01-15',
      });

      expect(result.success).toBe(true);
      expect(entryRepository.save).toHaveBeenCalled();
    });

    it('should use default diary when diaryId not provided', async () => {
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);

      await service.create(1, {
        tags: ['tag1'],
        text: 'New entry content',
      });

      expect(diaryRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 1, isDefault: true },
      });
    });

    it('should increment index for same day entries', async () => {
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      entryRepository.count.mockResolvedValue(2);
      entryRepository.save.mockResolvedValue(mockEntry);

      await service.create(1, {
        tags: ['tag1'],
        text: 'New entry content',
        date: '2024-01-15',
      });

      expect(entryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 3,
        }),
      );
    });
  });

  describe('update', () => {
    it('should update existing entry', async () => {
      entryRepository.findOne.mockResolvedValue(mockEntry);
      entryRepository.save.mockResolvedValue(mockEntry);
      entryRepository.find.mockResolvedValue([]);

      const result = await service.update(1, 1, {
        tags: ['updated'],
        text: 'Updated content',
        date: '2024-01-15',
      });

      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
    });

    it('should throw NotFoundException for non-existent entry', async () => {
      entryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(1, 999, {
          tags: ['updated'],
          text: 'Updated content',
          date: '2024-01-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reindex old date entries when date changes', async () => {
      entryRepository.findOne.mockResolvedValue({ ...mockEntry, date: '2024-01-14' });
      entryRepository.save.mockResolvedValue(mockEntry);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.find.mockResolvedValue([{ ...mockEntry, id: 2, index: 2 }]);

      await service.update(1, 1, {
        tags: ['updated'],
        text: 'Updated content',
        date: '2024-01-15',
      });

      expect(entryRepository.find).toHaveBeenCalled();
    });
  });

  describe('updateVisibility', () => {
    it('should update entry visibility', async () => {
      entryRepository.findOne.mockResolvedValue(mockEntry);
      entryRepository.save.mockResolvedValue({ ...mockEntry, visibility: 'public' });

      const result = await service.updateVisibility(1, 1, 'public');

      expect(result.success).toBe(true);
      expect(result.entry.visibility).toBe('public');
    });

    it('should throw NotFoundException for non-existent entry', async () => {
      entryRepository.findOne.mockResolvedValue(null);

      await expect(service.updateVisibility(1, 999, 'public')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHighlights', () => {
    it('should return random entry and on this day entries', async () => {
      const result = await service.getHighlights(1, {});

      expect(result).toHaveProperty('randomEntry');
      expect(result).toHaveProperty('onThisDay');
      expect(result).toHaveProperty('currentDate');
    });

    it('should filter by diaryId', async () => {
      const result = await service.getHighlights(1, { diaryId: 1 });

      expect(result).toHaveProperty('randomEntry');
    });
  });

  describe('deleteAll', () => {
    it('should delete all entries for user', async () => {
      const result = await service.deleteAll(1);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBeDefined();
    });

    it('should delete entries for specific diary', async () => {
      const result = await service.deleteAll(1, 1);

      expect(result.success).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete entry and reindex remaining', async () => {
      entryRepository.findOne.mockResolvedValue(mockEntry);
      entryRepository.delete.mockResolvedValue({ affected: 1 });
      entryRepository.find.mockResolvedValue([]);

      const result = await service.delete(1, 1);

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException for non-existent entry', async () => {
      entryRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('should reindex remaining entries after deletion', async () => {
      entryRepository.findOne.mockResolvedValue(mockEntry);
      entryRepository.delete.mockResolvedValue({ affected: 1 });
      entryRepository.find.mockResolvedValue([
        { ...mockEntry, id: 2, index: 3 },
        { ...mockEntry, id: 3, index: 4 },
      ]);
      entryRepository.save.mockResolvedValue(mockEntry);

      await service.delete(1, 1);

      expect(entryRepository.save).toHaveBeenCalledTimes(2);
    });
  });
});

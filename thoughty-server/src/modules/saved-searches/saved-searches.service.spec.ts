import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { BookVersion, Diary, SavedSearch } from '@/database/entities';
import { SAVED_SEARCH_LIMIT } from './dto';
import { SavedSearchesService } from './saved-searches.service';

const filters = {
  search: '',
  searchMode: 'keyword' as const,
  sort: 'relevance' as const,
  tags: ['family', 'family', 'trips'],
  date: null,
  visibility: 'all' as const,
  archiveStatus: 'active' as const,
  favorites: true,
  mood: '',
};
const createdAt = new Date('2026-10-27T09:00:00Z');

describe('SavedSearchesService', () => {
  let savedRepository: Record<string, jest.Mock>;
  let diaryRepository: { exists: jest.Mock };
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let queryBuilder: Record<string, jest.Mock>;
  let countBuilder: Record<string, jest.Mock>;
  let bookVersionRepository: Record<string, jest.Mock>;
  let service: SavedSearchesService;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    countBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    bookVersionRepository = {
      createQueryBuilder: jest.fn(() => countBuilder),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    diaryRepository = { exists: jest.fn().mockResolvedValue(true) };
    savedRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 4, createdAt, updatedAt: createdAt, ...value })),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    manager = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn((entity) => {
        if (entity === Diary) return diaryRepository;
        return entity === BookVersion ? bookVersionRepository : savedRepository;
      }),
    };
    savedRepository.manager = { transaction: jest.fn((work) => work(manager)) } as never;
    service = new SavedSearchesService(savedRepository as never, bookVersionRepository as never);
  });

  it('lists the writer’s searches by name with the limit and how many book versions each holds', async () => {
    queryBuilder.getMany.mockResolvedValue([
      { id: 2, userId: 7, name: 'Family', diaryId: null, filters, createdAt, updatedAt: createdAt },
      { id: 3, userId: 7, name: 'Trips', diaryId: null, filters, createdAt, updatedAt: createdAt },
    ]);
    countBuilder.getRawMany.mockResolvedValue([{ scopeKey: 'search:3', count: '2' }]);

    await expect(service.list(7)).resolves.toEqual({
      savedSearches: [
        { id: 2, name: 'Family', diaryId: null, filters, bookVersionCount: 0, createdAt, updatedAt: createdAt },
        { id: 3, name: 'Trips', diaryId: null, filters, bookVersionCount: 2, createdAt, updatedAt: createdAt },
      ],
      limit: SAVED_SEARCH_LIMIT,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith('saved.user_id = :userId', { userId: 7 });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('LOWER(saved.name)', 'ASC');
    expect(countBuilder.where).toHaveBeenCalledWith('version.user_id = :userId', { userId: 7 });
    expect(countBuilder.andWhere).toHaveBeenCalledWith('version.scope_key IN (:...scopeKeys)', {
      scopeKeys: ['search:2', 'search:3'],
    });
  });

  it('does not count book versions when there are no saved searches', async () => {
    await expect(service.list(7)).resolves.toEqual({ savedSearches: [], limit: SAVED_SEARCH_LIMIT });
    expect(bookVersionRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('saves a search under the writer’s lock with each tag once and only known filters', async () => {
    const result = await service.create(7, {
      name: 'Family',
      diaryId: 3,
      filters: { ...filters, extra: 'dropped' } as never,
    });

    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['saved_searches', 7]);
    expect(diaryRepository.exists).toHaveBeenCalledWith({ where: { id: 3, userId: 7 } });
    expect(savedRepository.count).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(savedRepository.save).toHaveBeenCalledWith({
      userId: 7,
      name: 'Family',
      diaryId: 3,
      filters: { ...filters, tags: ['family', 'trips'] },
    });
    expect(result).toEqual({
      id: 4,
      name: 'Family',
      diaryId: 3,
      filters: { ...filters, tags: ['family', 'trips'] },
      bookVersionCount: 0,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('does not look up a diary for a search over all diaries', async () => {
    await service.create(7, { name: 'All', diaryId: null, filters });

    expect(diaryRepository.exists).not.toHaveBeenCalled();
  });

  it('refuses another writer’s diary', async () => {
    diaryRepository.exists.mockResolvedValue(false);

    await expectApiError(service.create(7, { name: 'Family', diaryId: 9, filters }), NotFoundException, 'DIARY_NOT_FOUND');
    expect(savedRepository.save).not.toHaveBeenCalled();
  });

  it('refuses a search past the limit', async () => {
    savedRepository.count.mockResolvedValue(SAVED_SEARCH_LIMIT);

    await expectApiError(service.create(7, { name: 'One more', diaryId: null, filters }), BadRequestException, 'SAVED_SEARCH_LIMIT_REACHED');
    expect(savedRepository.save).not.toHaveBeenCalled();
  });

  it('turns a name clash into a coded conflict and passes other failures on', async () => {
    savedRepository.save.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    await expectApiError(service.create(7, { name: 'family', diaryId: null, filters }), ConflictException, 'SAVED_SEARCH_NAME_TAKEN');

    savedRepository.save.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.create(7, { name: 'Family', diaryId: null, filters })).rejects.toThrow('connection lost');
  });

  it('finds only the writer’s own search', async () => {
    const saved = { id: 4, userId: 7, name: 'Family' };
    savedRepository.findOne.mockResolvedValueOnce(saved).mockResolvedValueOnce(null);

    await expect(service.findOwn(7, 4)).resolves.toBe(saved);
    expect(savedRepository.findOne).toHaveBeenCalledWith({ where: { id: 4, userId: 7 } });
    await expectApiError(service.findOwn(8, 4), NotFoundException, 'SAVED_SEARCH_NOT_FOUND');
  });

  it('renames only the writer’s own search', async () => {
    const saved = { id: 4, userId: 7, name: 'Family', diaryId: null, filters, createdAt, updatedAt: createdAt } as SavedSearch;
    savedRepository.findOne.mockResolvedValueOnce(saved);

    countBuilder.getRawMany.mockResolvedValueOnce([{ scopeKey: 'search:4', count: 3 }]);
    await expect(service.rename(7, 4, { name: 'Family, 2019' }))
      .resolves.toEqual(expect.objectContaining({ id: 4, name: 'Family, 2019', bookVersionCount: 3 }));
    expect(savedRepository.findOne).toHaveBeenCalledWith({ where: { id: 4, userId: 7 } });

    savedRepository.findOne.mockResolvedValueOnce(null);
    await expectApiError(service.rename(7, 5, { name: 'Other' }), NotFoundException, 'SAVED_SEARCH_NOT_FOUND');

    savedRepository.findOne.mockResolvedValueOnce({ ...saved });
    savedRepository.save.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    await expectApiError(service.rename(7, 4, { name: 'Trips' }), ConflictException, 'SAVED_SEARCH_NAME_TAKEN');
  });

  it('deletes only the writer’s own search, with its book versions, under their history’s lock', async () => {
    savedRepository.delete.mockResolvedValueOnce({ affected: 1 });
    await expect(service.delete(7, 4)).resolves.toEqual({ success: true });
    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, hashtext($2))', [7, 'search:4']);
    expect(savedRepository.delete).toHaveBeenCalledWith({ id: 4, userId: 7 });
    expect(bookVersionRepository.delete).toHaveBeenCalledWith({ userId: 7, scopeKey: 'search:4' });

    bookVersionRepository.delete.mockClear();
    savedRepository.delete.mockResolvedValueOnce({ affected: 0 });
    await expectApiError(service.delete(7, 5), NotFoundException, 'SAVED_SEARCH_NOT_FOUND');
    expect(bookVersionRepository.delete).not.toHaveBeenCalled();
  });
});

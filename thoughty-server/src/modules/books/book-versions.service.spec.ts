import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookVersion, SavedSearch } from '@/database/entities';
import { BooksService, type BookFile } from './books.service';
import { BookVersionsService } from './book-versions.service';
import { expectApiError } from '@/common/errors/api-error.test-helpers';

describe('BookVersionsService', () => {
  let service: BookVersionsService;
  let repository: any;
  let transactionalRepository: any;
  let booksService: any;
  let lockQuery: jest.Mock;
  let savedSearchRepository: { exists: jest.Mock };

  const artifact = (
    chapters: Array<{ title: string; entryIds: number[] }>,
    source: BookFile['source'] = { kind: 'journal', diaryId: 3 },
  ): BookFile => ({
    content: '# Saved book',
    filename: 'thoughty_book_My_Book_2026-08-01.md',
    contentType: 'text/markdown; charset=utf-8',
    title: 'My Book',
    author: 'jane',
    sourceManifest: { chapters },
    source,
  });

  beforeEach(async () => {
    transactionalRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({
        id: 10,
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
        ...value,
      })),
    };
    lockQuery = jest.fn();
    savedSearchRepository = { exists: jest.fn().mockResolvedValue(true) };
    repository = {
      find: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn(async (callback) =>
          callback({
            query: lockQuery,
            getRepository: jest.fn((entity) =>
              entity === SavedSearch ? savedSearchRepository : transactionalRepository,
            ),
          }),
        ),
      },
      createQueryBuilder: jest.fn(),
    };
    booksService = {
      export: jest.fn().mockResolvedValue(
        artifact([
          { title: 'Travel', entryIds: [1, 2] },
          { title: 'Food', entryIds: [2] },
        ]),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookVersionsService,
        { provide: getRepositoryToken(BookVersion), useValue: repository },
        { provide: BooksService, useValue: booksService },
      ],
    }).compile();
    service = module.get(BookVersionsService);
  });

  it('lists only versions in the authenticated user journal scope', async () => {
    repository.find.mockResolvedValue([
      {
        id: 4,
        versionNumber: 2,
        title: 'My Book',
        author: null,
        format: 'pdf',
        filename: 'book_v2.pdf',
        chapterCount: 2,
        entryCount: 3,
        addedEntryCount: 1,
        addedChapterTitles: ['Food'],
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
      },
    ]);

    const result = await service.list(7, { diaryId: 3 });

    expect(repository.find).toHaveBeenCalledWith({
      where: { userId: 7, scopeKey: 'diary:3' },
      order: { versionNumber: 'DESC' },
    });
    expect(result[0]).toMatchObject({ id: 4, versionNumber: 2, addedChapterTitles: ['Food'] });
  });

  it('reads versions made before sources were recorded as journal books of their diary', async () => {
    repository.find.mockResolvedValue([
      { id: 4, diaryId: 3, createdAt: new Date('2026-08-01T12:00:00.000Z') },
      {
        id: 5,
        diaryId: null,
        source: { kind: 'savedSearch', savedSearchId: 2, savedSearchName: 'Family' },
        createdAt: new Date('2026-08-02T12:00:00.000Z'),
      },
    ]);

    const result = await service.list(7);

    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7, scopeKey: 'all' } }));
    expect(result.map((version) => version.source)).toEqual([
      { kind: 'journal', diaryId: 3 },
      { kind: 'savedSearch', savedSearchId: 2, savedSearchName: 'Family' },
    ]);
  });

  it('keeps one history per saved search and one for hand-picked books', async () => {
    await service.list(7, { source: 'savedSearch', savedSearchId: 2 });
    await service.list(7, { source: 'entries' });

    expect(repository.find.mock.calls.map(([options]: [{ where: { scopeKey: string } }]) => options.where.scopeKey)).toEqual(['search:2', 'picked']);
    await expectApiError(service.list(7, { source: 'savedSearch' }), BadRequestException, 'BOOK_SAVED_SEARCH_REQUIRED');
  });

  it('records the source of a version and numbers it within that source', async () => {
    booksService.export.mockResolvedValueOnce(
      artifact([{ title: 'Letters', entryIds: [5, 6] }], { kind: 'entries', entryIds: [6, 5] }),
    );
    await service.create(7, { source: 'entries', entryIds: '6,5' });
    booksService.export.mockResolvedValueOnce(
      artifact([{ title: 'Family', entryIds: [1] }], { kind: 'savedSearch', savedSearchId: 2, savedSearchName: 'Family' }),
    );
    await service.create(7, { source: 'savedSearch', savedSearchId: 2 });

    expect(transactionalRepository.create.mock.calls.map(([version]: [Record<string, unknown>]) => [version.scopeKey, version.diaryId, version.source]))
      .toEqual([
        ['picked', null, { kind: 'entries', entryIds: [6, 5] }],
        ['search:2', null, { kind: 'savedSearch', savedSearchId: 2, savedSearchName: 'Family' }],
      ]);
    expect(lockQuery).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, hashtext($2))', [7, 'picked']);
    expect(transactionalRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7, scopeKey: 'search:2' } }),
    );
    expect(savedSearchRepository.exists).toHaveBeenCalledTimes(1);
    expect(savedSearchRepository.exists).toHaveBeenCalledWith({ where: { id: 2, userId: 7 } });
  });

  it('refuses a version of a saved search deleted while its book was built', async () => {
    booksService.export.mockResolvedValueOnce(
      artifact([{ title: 'Family', entryIds: [1] }], { kind: 'savedSearch', savedSearchId: 2, savedSearchName: 'Family' }),
    );
    savedSearchRepository.exists.mockResolvedValueOnce(false);

    await expectApiError(
      service.create(7, { source: 'savedSearch', savedSearchId: 2 }),
      NotFoundException,
      'SAVED_SEARCH_NOT_FOUND',
    );
    expect(lockQuery).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, hashtext($2))', [7, 'search:2']);
    expect(transactionalRepository.save).not.toHaveBeenCalled();
  });

  it('saves the first immutable artifact with all source entries and chapters marked new', async () => {
    const result = await service.create(7, { diaryId: 3, format: 'md', narrative: false });

    expect(booksService.export).toHaveBeenCalledWith(
      7,
      { diaryId: 3, format: 'md', narrative: false },
      undefined,
    );
    expect(transactionalRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        diaryId: 3,
        scopeKey: 'diary:3',
        source: { kind: 'journal', diaryId: 3 },
        versionNumber: 1,
        filename: 'thoughty_book_My_Book_2026-08-01_v1.md',
        content: Buffer.from('# Saved book'),
        chapterCount: 2,
        entryCount: 3,
        addedEntryCount: 2,
        addedChapterTitles: ['Travel', 'Food'],
      }),
    );
    expect(result).toMatchObject({ versionNumber: 1, addedEntryCount: 2 });
  });

  it('calculates additions against the latest version without double-counting tagged entries', async () => {
    transactionalRepository.findOne.mockResolvedValue({
      versionNumber: 2,
      manifest: {
        chapters: [
          { title: 'Travel', entryIds: [1, 2] },
          { title: 'Food', entryIds: [2] },
        ],
      },
    });
    booksService.export.mockResolvedValue(
      artifact([
        { title: 'Travel', entryIds: [1, 2, 3] },
        { title: 'Food', entryIds: [2, 3] },
        { title: 'Work', entryIds: [4] },
      ]),
    );

    const result = await service.create(7, { diaryId: 3, format: 'md' });

    expect(transactionalRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        versionNumber: 3,
        addedEntryCount: 2,
        addedChapterTitles: ['Work'],
      }),
    );
    expect(result.versionNumber).toBe(3);
  });

  it('rejects artifacts above the storage limit', async () => {
    booksService.export.mockResolvedValue({
      ...artifact([]),
      content: Buffer.alloc(50 * 1024 * 1024 + 1),
    });

    await expect(service.create(7, {})).rejects.toThrow(BadRequestException);
    expect(repository.manager.transaction).not.toHaveBeenCalled();
  });

  it('downloads only a version owned by the authenticated user', async () => {
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        content: Buffer.from('saved'),
        filename: 'book_v2.pdf',
        contentType: 'application/pdf',
        title: 'Book',
        author: null,
        manifest: { chapters: [] },
        source: { kind: 'entries', entryIds: [1] },
      }),
    };
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.download(7, 4);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('version.user_id = :userId', { userId: 7 });
    expect(result.filename).toBe('book_v2.pdf');
    expect(result.source).toEqual({ kind: 'entries', entryIds: [1] });

    queryBuilder.getOne.mockResolvedValue(null);
    await expect(service.download(8, 4)).rejects.toThrow(NotFoundException);
  });
});

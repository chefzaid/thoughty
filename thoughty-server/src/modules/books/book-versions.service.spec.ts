import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookVersion } from '@/database/entities';
import { BooksService, type BookFile } from './books.service';
import { BookVersionsService } from './book-versions.service';

describe('BookVersionsService', () => {
  let service: BookVersionsService;
  let repository: any;
  let transactionalRepository: any;
  let booksService: any;

  const artifact = (chapters: Array<{ title: string; entryIds: number[] }>): BookFile => ({
    content: '# Saved book',
    filename: 'thoughty_book_My_Book_2026-08-01.md',
    contentType: 'text/markdown; charset=utf-8',
    title: 'My Book',
    author: 'jane',
    sourceManifest: { chapters },
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
    repository = {
      find: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn(async (callback) =>
          callback({
            query: jest.fn(),
            getRepository: jest.fn(() => transactionalRepository),
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

    const result = await service.list(7, 3);

    expect(repository.find).toHaveBeenCalledWith({
      where: { userId: 7, scopeKey: 'diary:3' },
      order: { versionNumber: 'DESC' },
    });
    expect(result[0]).toMatchObject({ id: 4, versionNumber: 2, addedChapterTitles: ['Food'] });
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
        scopeKey: 'diary:3',
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
      }),
    };
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.download(7, 4);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('version.user_id = :userId', { userId: 7 });
    expect(result.filename).toBe('book_v2.pdf');

    queryBuilder.getOne.mockResolvedValue(null);
    await expect(service.download(8, 4)).rejects.toThrow(NotFoundException);
  });
});

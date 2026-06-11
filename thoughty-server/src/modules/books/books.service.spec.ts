import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BooksService } from './books.service';
import { AiService } from '@/modules/ai';
import { Entry, Diary, User } from '@/database/entities';

describe('BooksService', () => {
  let service: BooksService;
  let entryRepository: any;
  let diaryRepository: any;
  let userRepository: any;
  let aiService: any;
  let mockQueryBuilder: any;

  const mockEntries = [
    { date: '2024-01-10', index: 1, tags: ['travel', 'food'], content: 'Pasta in Naples', format: 'plain' },
    { date: '2024-01-15', index: 1, tags: ['travel'], content: 'Trip to Rome', format: 'plain' },
    { date: '2024-03-05', index: 1, tags: [], content: 'Random thought', format: 'plain' },
  ];

  const mockDiary = { id: 1, userId: 1, name: 'Test Diary' };
  const mockUser = { id: 1, username: 'jane' };

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockEntries),
    };

    entryRepository = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    diaryRepository = {
      findOne: jest.fn().mockResolvedValue(mockDiary),
    };

    userRepository = {
      findOne: jest.fn().mockResolvedValue(mockUser),
    };

    aiService = {
      isConfigured: jest.fn().mockReturnValue(true),
      composeBookChapter: jest.fn().mockResolvedValue('Woven chapter prose.'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: AiService, useValue: aiService },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildBookForUser', () => {
    it('should default the title to the diary name and the author to the username', async () => {
      const book = await service.buildBookForUser(1, { diaryId: 1 });

      expect(book.title).toBe('Test Diary');
      expect(book.author).toBe('jane');
    });

    it('should use the provided title and author', async () => {
      const book = await service.buildBookForUser(1, { title: 'Custom', author: 'John' });

      expect(book.title).toBe('Custom');
      expect(book.author).toBe('John');
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fall back to a default title without a diary', async () => {
      const book = await service.buildBookForUser(1, {});

      expect(book.title).toBe('My Book of Thoughts');
    });

    it('should throw NotFoundException for a diary the user does not own', async () => {
      diaryRepository.findOne.mockResolvedValue(null);

      await expect(service.buildBookForUser(1, { diaryId: 99 })).rejects.toThrow(NotFoundException);
    });

    it('should filter by diary and date range', async () => {
      await service.buildBookForUser(1, { diaryId: 1, dateFrom: '2024-01-01', dateTo: '2024-02-01' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 1 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('e.date >= :dateFrom', { dateFrom: '2024-01-01' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('e.date <= :dateTo', { dateTo: '2024-02-01' });
    });

    it('should exclude archived entries', async () => {
      await service.buildBookForUser(1, {});

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('e.is_archived = false');
    });

    it('should pass the parsed tag filter to the book builder', async () => {
      const book = await service.buildBookForUser(1, { tags: 'travel, , ' });

      expect(book.chapters.map((c) => c.title)).toEqual(['travel']);
    });
  });

  describe('preview', () => {
    it('should return the chapter outline with counts and date ranges', async () => {
      const preview = await service.preview(1, {});

      expect(preview.title).toBe('My Book of Thoughts');
      expect(preview.chapterCount).toBe(3); // food, travel, untagged
      expect(preview.entryCount).toBe(4); // multi-tag entry counted in both chapters
      const travel = preview.chapters.find((c) => c.title === 'travel');
      expect(travel).toEqual({
        title: 'travel',
        entryCount: 2,
        firstDate: '2024-01-10',
        lastDate: '2024-01-15',
      });
    });
  });

  describe('export', () => {
    it('should export a PDF by default', async () => {
      const result = await service.export(1, { narrative: false });

      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/^thoughty_book_My_Book_of_Thoughts_\d{4}-\d{2}-\d{2}\.pdf$/);
      expect(Buffer.isBuffer(result.content)).toBe(true);
      expect((result.content as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      expect(aiService.composeBookChapter).not.toHaveBeenCalled();
    });

    it('should export Markdown when requested', async () => {
      const result = await service.export(1, { format: 'md', title: 'Custom', narrative: false });

      expect(result.contentType).toBe('text/markdown; charset=utf-8');
      expect(result.filename).toMatch(/\.md$/);
      expect(result.content).toContain('# Custom');
    });

    it('should export an EPUB when requested', async () => {
      const result = await service.export(1, { format: 'epub', narrative: false });

      expect(result.contentType).toBe('application/epub+zip');
      expect(result.filename).toMatch(/\.epub$/);
      expect(Buffer.isBuffer(result.content)).toBe(true);
      expect((result.content as Buffer).subarray(0, 2).toString()).toBe('PK');
    });

    it('should export HTML when requested', async () => {
      const result = await service.export(1, { format: 'html', narrative: false });

      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(result.filename).toMatch(/\.html$/);
      expect(result.content).toContain('<!DOCTYPE html>');
    });

    it('should sanitize the title used in the filename', async () => {
      const result = await service.export(1, { format: 'md', title: 'My Life: Vol. 1!', narrative: false });

      expect(result.filename).toMatch(/^thoughty_book_My_Life__Vol__1__\d{4}-\d{2}-\d{2}\.md$/);
    });

    it('should weave chapters into AI narrative prose by default', async () => {
      const result = await service.export(1, { format: 'md' });

      expect(aiService.composeBookChapter).toHaveBeenCalledTimes(3); // food, travel, untagged
      expect(aiService.composeBookChapter).toHaveBeenCalledWith(
        1,
        'travel',
        expect.arrayContaining([
          expect.objectContaining({ date: '2024-01-10', content: 'Pasta in Naples' }),
        ]),
      );
      expect(result.content).toContain('Woven chapter prose.');
      expect(result.content).not.toContain('### 2024-01-10');
    });

    it('should reject narrative export when AI is not configured', async () => {
      aiService.isConfigured.mockReturnValue(false);

      await expect(service.export(1, {})).rejects.toThrow(BadRequestException);
      expect(aiService.composeBookChapter).not.toHaveBeenCalled();
    });
  });
});

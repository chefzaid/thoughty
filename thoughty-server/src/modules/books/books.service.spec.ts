import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BooksService } from './books.service';
import { AiBookComposerService } from '@/modules/ai';
import { AttachmentsService } from '@/modules/attachments';
import { Entry, Diary, User } from '@/database/entities';

describe('BooksService', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  let service: BooksService;
  let entryRepository: any;
  let diaryRepository: any;
  let userRepository: any;
  let aiService: any;
  let attachmentsService: any;
  let mockQueryBuilder: any;

  const mockEntries = [
    {
      id: 1,
      date: '2024-01-10',
      index: 1,
      tags: ['travel', 'food'],
      content: 'Pasta in Naples',
      format: 'plain',
      attachments: [{
        id: 10,
        originalFilename: 'naples.png',
        storedFilename: 'stored-naples.png',
        mimetype: 'image/png',
        size: png.length,
      }],
    },
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
      leftJoinAndSelect: jest.fn().mockReturnThis(),
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
      composeChapterFraming: jest.fn().mockResolvedValue({
        introduction: 'A chapter opening.',
        summary: 'A chapter recap.',
      }),
    };
    attachmentsService = {
      getFileBuffer: jest.fn().mockResolvedValue(png),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: AiBookComposerService, useValue: aiService },
        { provide: AttachmentsService, useValue: attachmentsService },
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

    it('should support yearbook chapter grouping', async () => {
      const book = await service.buildBookForUser(1, { chapterMode: 'year' });

      expect(book.chapters.map((c) => c.title)).toEqual(['2024']);
      expect(book.chapters[0].entries).toHaveLength(3);
    });

    it('should join eligible image metadata only when image embedding is requested', async () => {
      await service.buildBookForUser(1, { embedImages: true });

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'e.attachments',
        'bookAttachment',
        'bookAttachment.mimetype IN (:...imageTypes)',
        { imageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] },
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        'bookAttachment.created_at',
        'ASC',
      );
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

    it(
      'should export an EPUB when requested',
      async () => {
        const result = await service.export(1, { format: 'epub', narrative: false });

        expect(result.contentType).toBe('application/epub+zip');
        expect(result.filename).toMatch(/\.epub$/);
        expect(Buffer.isBuffer(result.content)).toBe(true);
        expect((result.content as Buffer).subarray(0, 2).toString()).toBe('PK');
      },
      20_000,
    );

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
        'strict',
      );
      expect(result.content).toContain('Woven chapter prose.');
      expect(result.content).not.toContain('### 2024-01-10');
    });

    it('should pass the requested creative weaving mode to the AI composer', async () => {
      await service.export(1, { format: 'md', weavingMode: 'creative' });

      expect(aiService.composeBookChapter).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        expect.any(Array),
        'creative',
      );
    });

    it('should add AI introductions and summaries to plain chapters when requested', async () => {
      const result = await service.export(1, {
        format: 'md',
        narrative: false,
        chapterFraming: true,
      });

      expect(aiService.composeBookChapter).not.toHaveBeenCalled();
      expect(aiService.composeChapterFraming).toHaveBeenCalledTimes(3);
      expect(aiService.composeChapterFraming).toHaveBeenCalledWith(
        1,
        'travel',
        expect.arrayContaining([
          expect.objectContaining({ date: '2024-01-10', content: 'Pasta in Naples' }),
        ]),
      );
      expect(result.content).toContain('### Introduction');
      expect(result.content).toContain('A chapter opening.');
      expect(result.content).toContain('### Chapter Summary');
      expect(result.content).toContain('A chapter recap.');
      expect(result.content).toContain('Pasta in Naples');
    });

    it('should reject chapter framing when AI is not configured', async () => {
      aiService.isConfigured.mockReturnValue(false);

      await expect(
        service.export(1, { narrative: false, chapterFraming: true }),
      ).rejects.toThrow(BadRequestException);
      expect(aiService.composeChapterFraming).not.toHaveBeenCalled();
    });

    it('should reject narrative export when AI is not configured', async () => {
      aiService.isConfigured.mockReturnValue(false);

      await expect(service.export(1, {})).rejects.toThrow(BadRequestException);
      expect(aiService.composeBookChapter).not.toHaveBeenCalled();
    });

    it('should apply the selected cover theme and validated image', async () => {
      const coverImage = {
        buffer: png,
        mimetype: 'image/png',
        size: png.length,
        originalname: 'cover.png',
      } as Express.Multer.File;

      const result = await service.export(
        1,
        { format: 'html', narrative: false, coverTheme: 'ocean' },
        coverImage,
      );

      expect(result.content).toContain('background:#e0f2fe');
      expect(result.content).toContain(`data:image/png;base64,${png.toString('base64')}`);
    });

    it('should reject a cover image with unsupported or spoofed content', async () => {
      const spoofedImage = {
        buffer: Buffer.from('not a png'),
        mimetype: 'image/png',
        size: 9,
        originalname: 'cover.png',
      } as Express.Multer.File;

      await expect(
        service.export(1, { format: 'html', narrative: false }, spoofedImage),
      ).rejects.toThrow('invalid');
    });

    it('should reject oversized cover images', async () => {
      const oversizedImage = {
        buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
        mimetype: 'image/jpeg',
        size: 2 * 1024 * 1024 + 1,
        originalname: 'cover.jpg',
      } as Express.Multer.File;

      await expect(
        service.export(1, { format: 'html', narrative: false }, oversizedImage),
      ).rejects.toThrow('no larger than 2 MB');
    });

    it('should report a cover image that passes metadata checks but cannot be decoded', async () => {
      const corruptPng = Buffer.alloc(24);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(corruptPng);
      corruptPng.writeUInt32BE(1, 16);
      corruptPng.writeUInt32BE(1, 20);
      const coverImage = {
        buffer: corruptPng,
        mimetype: 'image/png',
        size: corruptPng.length,
        originalname: 'cover.png',
      } as Express.Multer.File;

      await expect(
        service.export(1, { narrative: false }, coverImage),
      ).rejects.toThrow('could not be decoded');
    });

    it('should fetch each image once and embed it in every matching chapter', async () => {
      const result = await service.export(1, {
        format: 'md',
        narrative: false,
        embedImages: true,
      });
      const dataUri = `data:image/png;base64,${png.toString('base64')}`;

      expect(attachmentsService.getFileBuffer).toHaveBeenCalledTimes(1);
      expect(attachmentsService.getFileBuffer).toHaveBeenCalledWith(
        'stored-naples.png',
        5 * 1024 * 1024,
      );
      expect((result.content as string).split(dataUri)).toHaveLength(3);
    });

    it('should retain chapter images in AI-woven output', async () => {
      const result = await service.export(1, {
        format: 'html',
        embedImages: true,
      });

      expect(result.content).toContain('Woven chapter prose.');
      expect(result.content).toContain('naples.png');
      expect(result.content).toContain('data:image/png;base64,');
    });

    it('should skip unavailable and oversized image attachments without failing export', async () => {
      attachmentsService.getFileBuffer.mockRejectedValue(new Error('storage unavailable'));
      const missingResult = await service.export(1, {
        format: 'md',
        narrative: false,
        embedImages: true,
      });
      expect(missingResult.content).not.toContain('data:image/png');

      attachmentsService.getFileBuffer.mockResolvedValue(Buffer.from('spoofed'));
      const spoofedResult = await service.export(1, {
        format: 'html',
        narrative: false,
        embedImages: true,
      });
      expect(spoofedResult.content).not.toContain('data:image/png');

      mockQueryBuilder.getMany.mockResolvedValueOnce([{
        ...mockEntries[0],
        attachments: [{
          ...mockEntries[0].attachments![0],
          size: 6 * 1024 * 1024,
        }],
      }]);
      attachmentsService.getFileBuffer.mockClear();
      await service.export(1, {
        format: 'md',
        narrative: false,
        embedImages: true,
      });
      expect(attachmentsService.getFileBuffer).not.toHaveBeenCalled();
    });

    it('should enforce the aggregate image budget before storage reads', async () => {
      mockQueryBuilder.getMany.mockResolvedValueOnce([{
        ...mockEntries[0],
        attachments: Array.from({ length: 6 }, (_, index) => ({
          id: 100 + index,
          originalFilename: `image-${index}.png`,
          storedFilename: `stored-${index}.png`,
          mimetype: 'image/png',
          size: 5 * 1024 * 1024,
        })),
      }]);

      await service.export(1, {
        format: 'md',
        narrative: false,
        embedImages: true,
      });

      expect(attachmentsService.getFileBuffer).toHaveBeenCalledTimes(5);
    });
  });
});

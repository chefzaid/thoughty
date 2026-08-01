import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { CloudSyncService } from '@/modules/cloud-sync';
import { BookVersionsService } from './book-versions.service';

describe('BooksController', () => {
  let controller: BooksController;
  let booksService: any;
  let cloudSyncService: any;
  let bookVersionsService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    booksService = {
      preview: jest.fn(),
      export: jest.fn(),
    };
    cloudSyncService = {
      uploadFile: jest.fn(),
    };
    bookVersionsService = {
      list: jest.fn(),
      create: jest.fn(),
      download: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        { provide: BooksService, useValue: booksService },
        { provide: BookVersionsService, useValue: bookVersionsService },
        { provide: CloudSyncService, useValue: cloudSyncService },
      ],
    }).compile();

    controller = module.get<BooksController>(BooksController);
  });

  describe('versions', () => {
    it('lists versions in the requested journal scope', async () => {
      bookVersionsService.list.mockResolvedValue([{ id: 1, versionNumber: 1 }]);

      const result = await controller.listVersions(mockUser as any, { diaryId: 2 });

      expect(bookVersionsService.list).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual([{ id: 1, versionNumber: 1 }]);
    });

    it('creates the next version with an optional cover', async () => {
      const query = { diaryId: 2, format: 'epub' } as any;
      const cover = { buffer: Buffer.from('cover') } as any;
      bookVersionsService.create.mockResolvedValue({ id: 2, versionNumber: 2 });

      const result = await controller.createVersion(mockUser as any, query, cover);

      expect(bookVersionsService.create).toHaveBeenCalledWith(1, query, cover);
      expect(result).toEqual({ id: 2, versionNumber: 2 });
    });

    it('downloads a user-owned immutable version', async () => {
      const file = {
        content: Buffer.from('saved'),
        filename: 'book_v2.pdf',
        contentType: 'application/pdf',
      };
      const response = { setHeader: jest.fn(), send: jest.fn() } as any;
      bookVersionsService.download.mockResolvedValue(file);

      await controller.downloadVersion(mockUser as any, 2, response);

      expect(bookVersionsService.download).toHaveBeenCalledWith(1, 2);
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="book_v2.pdf"',
      );
      expect(response.send).toHaveBeenCalledWith(file.content);
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('preview', () => {
    it('delegates to booksService.preview', async () => {
      const query = { diaryId: 1 } as any;
      const expected = { title: 'Book', chapterCount: 2, entryCount: 5, chapters: [] };
      booksService.preview!.mockResolvedValue(expected);

      const result = await controller.preview(mockUser as any, query);

      expect(booksService.preview).toHaveBeenCalledWith(1, query);
      expect(result).toBe(expected);
    });
  });

  describe('export', () => {
    it('sets headers and sends the book file via response', async () => {
      const query = { format: 'pdf' } as any;
      const pdfBuffer = Buffer.from('%PDF-1.3 fake');
      booksService.export!.mockResolvedValue({
        content: pdfBuffer,
        filename: 'thoughty_book_My_Book_2024-06-01.pdf',
        contentType: 'application/pdf',
      });

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.export(mockUser as any, query, mockRes);

      expect(booksService.export).toHaveBeenCalledWith(1, query);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="thoughty_book_My_Book_2024-06-01.pdf"',
      );
      expect(mockRes.send).toHaveBeenCalledWith(pdfBuffer);
    });
  });

  describe('exportWithCover', () => {
    it('forwards the uploaded cover image and sends the generated file', async () => {
      const query = { format: 'html', coverTheme: 'ocean' } as any;
      const coverImage = { buffer: Buffer.from('image'), mimetype: 'image/png' } as any;
      const bookFile = {
        content: '<html></html>',
        filename: 'thoughty_book.html',
        contentType: 'text/html; charset=utf-8',
      };
      booksService.export.mockResolvedValue(bookFile);
      const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;

      await controller.exportWithCover(mockUser as any, query, coverImage, mockRes);

      expect(booksService.export).toHaveBeenCalledWith(1, query, coverImage);
      expect(mockRes.send).toHaveBeenCalledWith(bookFile.content);
    });
  });

  describe('upload', () => {
    it('generates and uploads the book for the authenticated user', async () => {
      const query = { provider: 'google_drive', diaryId: 2, format: 'epub' } as any;
      const bookFile = {
        content: Buffer.from('epub bytes'),
        filename: 'thoughty_book.epub',
        contentType: 'application/epub+zip',
      };
      const cloudFile = {
        id: 'file-1',
        name: 'thoughty_book.epub',
        size: 10,
        modifiedAt: '2026-07-23',
      };
      booksService.export.mockResolvedValue(bookFile);
      cloudSyncService.uploadFile.mockResolvedValue(cloudFile);

      const coverImage = { buffer: Buffer.from('image'), mimetype: 'image/png' } as any;
      const result = await controller.upload(mockUser as any, query, coverImage);

      expect(booksService.export).toHaveBeenCalledWith(
        1,
        { diaryId: 2, format: 'epub' },
        coverImage,
      );
      expect(cloudSyncService.uploadFile).toHaveBeenCalledWith(1, 'google_drive', bookFile);
      expect(result).toBe(cloudFile);
    });
  });
});

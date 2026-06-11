import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

describe('BooksController', () => {
  let controller: BooksController;
  let booksService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    booksService = {
      preview: jest.fn(),
      export: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [{ provide: BooksService, useValue: booksService }],
    }).compile();

    controller = module.get<BooksController>(BooksController);
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
});

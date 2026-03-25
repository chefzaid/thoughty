import { Test, TestingModule } from '@nestjs/testing';
import { IoController } from './io.controller';
import { IoService } from './io.service';

describe('IoController', () => {
  let controller: IoController;
  let ioService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    ioService = {
      getFormat: jest.fn(),
      saveFormat: jest.fn(),
      export: jest.fn(),
      preview: jest.fn(),
      import: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IoController],
      providers: [{ provide: IoService, useValue: ioService }],
    }).compile();

    controller = module.get<IoController>(IoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFormat', () => {
    it('delegates to ioService.getFormat', async () => {
      const expected = { entrySeparator: '---' };
      ioService.getFormat!.mockResolvedValue(expected);

      const result = await controller.getFormat(mockUser as any);
      expect(ioService.getFormat).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('saveFormat', () => {
    it('delegates to ioService.saveFormat', async () => {
      const dto = { entrySeparator: '===' } as any;
      const expected = { success: true };
      ioService.saveFormat!.mockResolvedValue(expected);

      const result = await controller.saveFormat(mockUser as any, dto);
      expect(ioService.saveFormat).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });
  });

  describe('export', () => {
    it('sets headers and sends content via response', async () => {
      const query = { diaryId: 1 } as any;
      ioService.export!.mockResolvedValue({
        content: 'exported data',
        filename: 'diary.txt',
      });

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.export(mockUser as any, query, mockRes);

      expect(ioService.export).toHaveBeenCalledWith(1, 1);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="diary.txt"',
      );
      expect(mockRes.send).toHaveBeenCalledWith('exported data');
    });
  });

  describe('preview', () => {
    it('delegates to ioService.preview', async () => {
      const dto = { content: 'file content' } as any;
      const expected = { entries: [], totalCount: 0, duplicates: [] };
      ioService.preview!.mockResolvedValue(expected as any);

      const result = await controller.preview(mockUser as any, dto);
      expect(ioService.preview).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });
  });

  describe('import', () => {
    it('delegates to ioService.import', async () => {
      const dto = { content: 'import data' } as any;
      const expected = { imported: 5, skipped: 2 };
      ioService.import!.mockResolvedValue(expected as any);

      const result = await controller.import(mockUser as any, dto);
      expect(ioService.import).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });
  });
});

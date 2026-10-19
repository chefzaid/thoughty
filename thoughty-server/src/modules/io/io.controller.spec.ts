import { Test, TestingModule } from '@nestjs/testing';
import { IoController } from './io.controller';
import { IoService } from './io.service';
import { AppImportService } from './app-import.service';
import { MarkdownArchiveService } from './markdown-archive.service';

describe('IoController', () => {
  let controller: IoController;
  let ioService: any;
  let appImportService: { importEntries: jest.Mock; attachFiles: jest.Mock };
  let markdownArchiveService: { prepare: jest.Mock };

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    ioService = {
      getFormat: jest.fn(),
      saveFormat: jest.fn(),
      export: jest.fn(),
      preview: jest.fn(),
      import: jest.fn(),
    };
    appImportService = { importEntries: jest.fn(), attachFiles: jest.fn() };
    markdownArchiveService = { prepare: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IoController],
      providers: [
        { provide: IoService, useValue: ioService },
        { provide: AppImportService, useValue: appImportService },
        { provide: MarkdownArchiveService, useValue: markdownArchiveService },
      ],
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
        contentType: 'text/plain; charset=utf-8',
      });

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.export(mockUser as any, query, mockRes);

      expect(ioService.export).toHaveBeenCalledWith(1, 1, undefined, undefined);
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

  describe('Markdown folder export', () => {
    const createResponse = () => ({
      setHeader: jest.fn(),
      write: jest.fn(() => true),
      end: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      destroyed: false,
      writableEnded: false,
    });

    it('streams the archive as a ZIP download', async () => {
      const write = jest.fn(async (sink: (chunk: Buffer) => Promise<void>) => {
        await sink(Buffer.from('PK'));
      });
      markdownArchiveService.prepare.mockResolvedValue({ filename: 'thoughty_all_diaries_2026-10-19.zip', write });
      const res = createResponse();

      await controller.export(mockUser as any, { format: 'zip' } as any, res as any);

      expect(markdownArchiveService.prepare).toHaveBeenCalledWith(1, undefined);
      expect(ioService.export).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="thoughty_all_diaries_2026-10-19.zip"');
      expect(res.write).toHaveBeenCalledWith(Buffer.from('PK'));
      expect(res.end).toHaveBeenCalled();
    });

    it('cuts the connection when the archive fails after the download started', async () => {
      markdownArchiveService.prepare.mockResolvedValue({
        filename: 'a.zip',
        write: jest.fn().mockRejectedValue(new Error('storage unavailable')),
      });
      const res = createResponse();

      await controller.export(mockUser as any, { format: 'zip', diaryId: 4 } as any, res as any);

      expect(markdownArchiveService.prepare).toHaveBeenCalledWith(1, 4);
      expect(res.destroy).toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });

    it('answers with the error status when the diary is refused before streaming', async () => {
      markdownArchiveService.prepare.mockRejectedValue(new Error('Diary not found'));
      const res = createResponse();

      await expect(controller.export(mockUser as any, { format: 'zip', diaryId: 9 } as any, res as any)).rejects.toThrow('Diary not found');
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('app import', () => {
    it('delegates a batch of entries', async () => {
      const dto = { source: 'dayone', entries: [] } as any;
      const expected = { entries: [], importedCount: 0, alreadyImportedCount: 0, createdDiaries: [] };
      appImportService.importEntries.mockResolvedValue(expected);

      await expect(controller.importAppEntries(mockUser as any, dto)).resolves.toBe(expected);
      expect(appImportService.importEntries).toHaveBeenCalledWith(1, dto);
    });

    it('delegates uploaded files with their entry IDs', async () => {
      const files = [{ originalname: 'a.jpg' }] as any;
      const expected = { attachments: [] };
      appImportService.attachFiles.mockResolvedValue(expected);

      await expect(controller.importAttachments(mockUser as any, files, { entryIds: '12' })).resolves.toBe(expected);
      expect(appImportService.attachFiles).toHaveBeenCalledWith(1, files, '12');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let attachmentsService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  const mockAttachment = {
    id: 1,
    userId: 1,
    entryId: 10,
    originalFilename: 'photo.jpg',
    storedFilename: 'abc-uuid.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    attachmentsService = {
      upload: jest.fn(),
      getByEntry: jest.fn(),
      linkToEntry: jest.fn(),
      delete: jest.fn(),
      getFileStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        { provide: AttachmentsService, useValue: attachmentsService },
      ],
    }).compile();

    controller = module.get<AttachmentsController>(AttachmentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('delegates upload to service and returns mapped result', async () => {
      attachmentsService.upload.mockResolvedValue(mockAttachment);

      const mockFile = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('file-content'),
      } as Express.Multer.File;

      const result = await controller.upload(mockUser as any, mockFile, { entryId: 10 });

      expect(attachmentsService.upload).toHaveBeenCalledWith(1, mockFile, 10);
      expect(result).toEqual({
        id: 1,
        original_filename: 'photo.jpg',
        stored_filename: 'abc-uuid.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        entry_id: 10,
        created_at: mockAttachment.createdAt,
      });
    });

    it('uploads without entryId', async () => {
      const noEntryAttachment = { ...mockAttachment, entryId: null };
      attachmentsService.upload.mockResolvedValue(noEntryAttachment);

      const mockFile = { buffer: Buffer.alloc(0) } as Express.Multer.File;
      const result = await controller.upload(mockUser as any, mockFile, {});

      expect(attachmentsService.upload).toHaveBeenCalledWith(1, mockFile, undefined);
      expect(result.entry_id).toBeNull();
    });
  });

  describe('getByEntry', () => {
    it('returns mapped attachments for an entry', async () => {
      attachmentsService.getByEntry.mockResolvedValue([mockAttachment]);

      const result = await controller.getByEntry(mockUser as any, 10);

      expect(attachmentsService.getByEntry).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual([{
        id: 1,
        original_filename: 'photo.jpg',
        stored_filename: 'abc-uuid.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        entry_id: 10,
        created_at: mockAttachment.createdAt,
      }]);
    });

    it('returns empty array when no attachments', async () => {
      attachmentsService.getByEntry.mockResolvedValue([]);
      const result = await controller.getByEntry(mockUser as any, 10);
      expect(result).toEqual([]);
    });
  });

  describe('linkToEntry', () => {
    it('links an attachment to an entry', async () => {
      attachmentsService.linkToEntry.mockResolvedValue(mockAttachment);

      const result = await controller.linkToEntry(mockUser as any, 1, { entryId: 10 });

      expect(attachmentsService.linkToEntry).toHaveBeenCalledWith(1, 1, 10);
      expect(result.id).toBe(1);
      expect(result.entry_id).toBe(10);
    });

    it('throws NotFoundException when entryId is missing', async () => {
      await expect(
        controller.linkToEntry(mockUser as any, 1, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('delegates delete to service', async () => {
      attachmentsService.delete.mockResolvedValue({ success: true });

      const result = await controller.delete(mockUser as any, 1);

      expect(attachmentsService.delete).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual({ success: true });
    });
  });

  describe('serveFile', () => {
    it('streams a file from S3 when it exists', async () => {
      const mockStream = { pipe: jest.fn() };
      attachmentsService.getFileStream.mockResolvedValue({
        stream: mockStream,
        contentType: 'image/jpeg',
      });

      const mockRes = {
        setHeader: jest.fn(),
      };

      await controller.serveFile('abc-uuid.jpg', mockRes as any);

      expect(attachmentsService.getFileStream).toHaveBeenCalledWith('abc-uuid.jpg');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it('throws NotFoundException when S3 object does not exist', async () => {
      attachmentsService.getFileStream.mockRejectedValue(new Error('NoSuchKey'));

      const mockRes = { setHeader: jest.fn() };

      await expect(
        controller.serveFile('nonexistent.jpg', mockRes as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('sanitizes filename to prevent path traversal', async () => {
      const mockStream = { pipe: jest.fn() };
      attachmentsService.getFileStream.mockResolvedValue({
        stream: mockStream,
        contentType: 'text/plain',
      });

      const mockRes = { setHeader: jest.fn() };

      await controller.serveFile('../../../etc/passwd', mockRes as any);

      // Slashes are stripped, so ../../etc/passwd becomes ......etcpasswd
      expect(attachmentsService.getFileStream).toHaveBeenCalledWith('......etcpasswd');
    });
  });
});

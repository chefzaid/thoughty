import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AudioTranscriptionService } from './audio-transcription.service';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let attachmentsService: any;
  let audioTranscriptionService: any;

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
      linkToEntry: jest.fn(),
      delete: jest.fn(),
      getOwnedFile: jest.fn(),
    };
    audioTranscriptionService = { transcribe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        { provide: AttachmentsService, useValue: attachmentsService },
        { provide: AudioTranscriptionService, useValue: audioTranscriptionService },
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

  describe('linkToEntry', () => {
    it('links an attachment to an entry', async () => {
      attachmentsService.linkToEntry.mockResolvedValue(mockAttachment);

      const result = await controller.linkToEntry(mockUser as any, 1, { entryId: 10 });

      expect(attachmentsService.linkToEntry).toHaveBeenCalledWith(1, 1, 10);
      expect(result.id).toBe(1);
      expect(result.entry_id).toBe(10);
    });

    it('throws NotFoundException when entryId is missing', async () => {
      await expect(controller.linkToEntry(mockUser as any, 1, {})).rejects.toThrow(
        NotFoundException,
      );
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

  describe('transcribe', () => {
    it('transcribes an attachment for the authenticated user', async () => {
      const transcribedAt = new Date('2026-08-01T12:00:00Z');
      audioTranscriptionService.transcribe.mockResolvedValue({
        transcript: 'Voice note',
        transcribed_at: transcribedAt,
        cached: false,
      });

      await expect(controller.transcribe(mockUser as any, 4)).resolves.toEqual({
        transcript: 'Voice note',
        transcribed_at: transcribedAt,
        cached: false,
      });
      expect(audioTranscriptionService.transcribe).toHaveBeenCalledWith(1, 4);
    });
  });

  describe('serveFile', () => {
    const servedFile = (overrides: Record<string, unknown> = {}) => ({
      stream: { pipe: jest.fn(), on: jest.fn() },
      contentType: 'image/jpeg',
      originalFilename: 'photo.jpg',
      inline: true,
      ...overrides,
    });

    it('streams a file the caller owns with safe headers', async () => {
      const file = servedFile();
      attachmentsService.getOwnedFile.mockResolvedValue(file);
      const mockRes = { setHeader: jest.fn() };

      await controller.serveFile(mockUser as any, 'abc-uuid.jpg', mockRes as any);

      expect(attachmentsService.getOwnedFile).toHaveBeenCalledWith(1, 'abc-uuid.jpg');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `inline; filename="photo.jpg"; filename*=UTF-8''photo.jpg`,
      );
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.anything(),
      );
      expect(file.stream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it('serves SVG and text as sandboxed downloads with an escaped filename', async () => {
      attachmentsService.getOwnedFile.mockResolvedValue(
        servedFile({
          contentType: 'image/svg+xml',
          originalFilename: 'a"b\r\nX-Evil: 1é.svg',
          inline: false,
        }),
      );
      const mockRes = { setHeader: jest.fn() };

      await controller.serveFile(mockUser as any, 'abc-uuid.svg', mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="a_b__X-Evil_ 1_.svg"; filename*=UTF-8''a%22b%0D%0AX-Evil%3A%201%C3%A9.svg`,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'none'; sandbox",
      );
    });

    it('answers 404 for a file that is missing or belongs to someone else', async () => {
      attachmentsService.getOwnedFile.mockRejectedValue(new NotFoundException('File not found'));
      const mockRes = { setHeader: jest.fn() };

      await expect(
        controller.serveFile({ userId: 2 } as any, 'abc-uuid.jpg', mockRes as any),
      ).rejects.toThrow(NotFoundException);
      expect(attachmentsService.getOwnedFile).toHaveBeenCalledWith(2, 'abc-uuid.jpg');
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it('answers 404 when the storage object does not exist', async () => {
      attachmentsService.getOwnedFile.mockRejectedValue(new Error('NoSuchKey'));
      const mockRes = { setHeader: jest.fn() };

      await expect(
        controller.serveFile(mockUser as any, 'nonexistent.jpg', mockRes as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('sanitizes filename to prevent path traversal', async () => {
      attachmentsService.getOwnedFile.mockResolvedValue(servedFile());
      const mockRes = { setHeader: jest.fn() };

      await controller.serveFile(mockUser as any, '../../../etc/passwd', mockRes as any);

      // Slashes are stripped, so ../../etc/passwd becomes ......etcpasswd
      expect(attachmentsService.getOwnedFile).toHaveBeenCalledWith(1, '......etcpasswd');
    });
  });
});

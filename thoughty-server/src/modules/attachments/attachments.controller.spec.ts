import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { AttachmentsController, RangeNotSatisfiableException } from './attachments.controller';
import { VideoPosterService } from './video-poster.service';
import { AttachmentsService } from './attachments.service';
import { AudioTranscriptionService } from './audio-transcription.service';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let attachmentsService: any;
  let audioTranscriptionService: any;
  let videoPosterService: { setPoster: jest.Mock };

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
      findOwnedFile: jest.fn(),
      openFile: jest.fn(),
    };
    audioTranscriptionService = { transcribe: jest.fn() };
    videoPosterService = { setPoster: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        { provide: AttachmentsService, useValue: attachmentsService },
        { provide: AudioTranscriptionService, useValue: audioTranscriptionService },
        { provide: VideoPosterService, useValue: videoPosterService },
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

  describe('setPoster', () => {
    it("stores the caller's poster frame and answers the video's record", async () => {
      const poster = { buffer: Buffer.from([0xff, 0xd8]), mimetype: 'image/jpeg', size: 2 } as Express.Multer.File;
      videoPosterService.setPoster.mockResolvedValue({
        ...mockAttachment,
        mimetype: 'video/mp4',
        posterFilename: 'poster.jpg',
        posterSize: 2,
      });

      const result = await controller.setPoster(mockUser as any, 1, poster);

      expect(videoPosterService.setPoster).toHaveBeenCalledWith(1, 1, poster);
      expect(result).toEqual(expect.objectContaining({ id: 1, mimetype: 'video/mp4', poster_filename: 'poster.jpg' }));
    });
  });

  describe('serveFile', () => {
    const ownedFile = (overrides: Record<string, unknown> = {}) => ({
      key: 'abc-uuid.jpg',
      contentType: 'image/jpeg',
      originalFilename: 'photo.jpg',
      inline: true,
      size: 1000,
      ...overrides,
    });
    const openedFile = (contentLength?: number) => ({
      stream: { pipe: jest.fn(), on: jest.fn() },
      contentLength,
    });
    const response = () => ({ setHeader: jest.fn(), status: jest.fn(), destroy: jest.fn() });

    it('streams a file the caller owns with safe headers', async () => {
      const opened = openedFile(1000);
      attachmentsService.findOwnedFile.mockResolvedValue(ownedFile());
      attachmentsService.openFile.mockResolvedValue(opened);
      const mockRes = response();

      await controller.serveFile(mockUser as any, 'abc-uuid.jpg', undefined, mockRes as any);

      expect(attachmentsService.findOwnedFile).toHaveBeenCalledWith(1, 'abc-uuid.jpg');
      expect(attachmentsService.openFile).toHaveBeenCalledWith('abc-uuid.jpg', undefined);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', '1000');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `inline; filename="photo.jpg"; filename*=UTF-8''photo.jpg`,
      );
      expect(mockRes.setHeader).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.anything(),
      );
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(opened.stream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it('cuts the connection when the storage stream fails midway', async () => {
      const opened = openedFile();
      attachmentsService.findOwnedFile.mockResolvedValue(ownedFile());
      attachmentsService.openFile.mockResolvedValue(opened);
      const mockRes = response();

      await controller.serveFile(mockUser as any, 'abc-uuid.jpg', undefined, mockRes as any);
      const [event, onError] = opened.stream.on.mock.calls[0] as [string, () => void];
      onError();

      expect(event).toBe('error');
      expect(mockRes.destroy).toHaveBeenCalled();
      expect(mockRes.setHeader).not.toHaveBeenCalledWith('Content-Length', expect.anything());
    });

    it('answers one byte range with 206, as a video player asks when it seeks', async () => {
      const opened = openedFile(100);
      attachmentsService.findOwnedFile.mockResolvedValue(
        ownedFile({ key: 'clip.mp4', contentType: 'video/mp4', originalFilename: 'clip.mp4', size: 5000 }),
      );
      attachmentsService.openFile.mockResolvedValue(opened);
      const mockRes = response();

      await controller.serveFile(mockUser as any, 'clip.mp4', 'bytes=100-199', mockRes as any);

      expect(attachmentsService.openFile).toHaveBeenCalledWith('clip.mp4', { start: 100, end: 199 });
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.PARTIAL_CONTENT);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes 100-199/5000');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', '100');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
      expect(opened.stream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it('answers 416 with the file size for a range past its end, without opening it', async () => {
      attachmentsService.findOwnedFile.mockResolvedValue(ownedFile({ size: 5000 }));
      const mockRes = response();

      await expectApiError(
        controller.serveFile(mockUser as any, 'abc-uuid.jpg', 'bytes=5000-', mockRes as any),
        RangeNotSatisfiableException,
        'ATTACHMENT_RANGE_NOT_SATISFIABLE',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes */5000');
      expect(attachmentsService.openFile).not.toHaveBeenCalled();
    });

    it('builds its default body like the other exceptions', () => {
      expect(new RangeNotSatisfiableException().getResponse()).toEqual({
        statusCode: 416,
        message: 'Range Not Satisfiable',
      });
    });

    it('serves SVG and text as sandboxed downloads with an escaped filename', async () => {
      attachmentsService.findOwnedFile.mockResolvedValue(
        ownedFile({
          contentType: 'image/svg+xml',
          originalFilename: 'a"b\r\nX-Evil: 1é.svg',
          inline: false,
        }),
      );
      attachmentsService.openFile.mockResolvedValue(openedFile());
      const mockRes = response();

      await controller.serveFile(mockUser as any, 'abc-uuid.svg', undefined, mockRes as any);

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
      attachmentsService.findOwnedFile.mockRejectedValue(new NotFoundException('File not found'));
      const mockRes = response();

      await expect(
        controller.serveFile({ userId: 2 } as any, 'abc-uuid.jpg', undefined, mockRes as any),
      ).rejects.toThrow(NotFoundException);
      expect(attachmentsService.findOwnedFile).toHaveBeenCalledWith(2, 'abc-uuid.jpg');
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it('answers 404 when the storage object does not exist', async () => {
      attachmentsService.findOwnedFile.mockResolvedValue(ownedFile());
      attachmentsService.openFile.mockRejectedValue(new Error('NoSuchKey'));
      const mockRes = response();

      await expect(
        controller.serveFile(mockUser as any, 'nonexistent.jpg', undefined, mockRes as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockRes.setHeader).not.toHaveBeenCalledWith('Content-Type', expect.anything());
    });

    it('sanitizes filename to prevent path traversal', async () => {
      attachmentsService.findOwnedFile.mockResolvedValue(ownedFile());
      attachmentsService.openFile.mockResolvedValue(openedFile());
      const mockRes = response();

      await controller.serveFile(mockUser as any, '../../../etc/passwd', undefined, mockRes as any);

      // Slashes are stripped, so ../../etc/passwd becomes ......etcpasswd
      expect(attachmentsService.findOwnedFile).toHaveBeenCalledWith(1, '......etcpasswd');
    });
  });
});

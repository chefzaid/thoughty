import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { AttachmentsService } from './attachments.service';
import { Attachment, Entry } from '@/database/entities';
import { Readable } from 'node:stream';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'PutObject' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'GetObject' })),
  DeleteObjectCommand: jest
    .fn()
    .mockImplementation((input) => ({ ...input, _type: 'DeleteObject' })),
  CreateBucketCommand: jest
    .fn()
    .mockImplementation((input) => ({ ...input, _type: 'CreateBucket' })),
  HeadBucketCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'HeadBucket' })),
}));

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let attachmentRepository: any;
  let entryRepository: any;

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
    mockSend.mockReset();
    mockSend.mockResolvedValue({});

    attachmentRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    entryRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepository },
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('creates bucket if it does not exist', async () => {
      mockSend.mockRejectedValueOnce(new Error('Not Found')).mockResolvedValueOnce({});

      await service.onModuleInit();

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('skips bucket creation if bucket already exists', async () => {
      mockSend.mockResolvedValueOnce({});

      await service.onModuleInit();

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('upload', () => {
    const mockFile = {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('file-content'),
    } as Express.Multer.File;

    it('uploads a file to S3 and saves to database', async () => {
      attachmentRepository.create.mockReturnValue(mockAttachment);
      attachmentRepository.save.mockResolvedValue(mockAttachment);
      mockSend.mockResolvedValue({});

      const result = await service.upload(1, mockFile);

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ _type: 'PutObject' }));
      expect(attachmentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          entryId: null,
          originalFilename: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
        }),
      );
      expect(result).toEqual(mockAttachment);
    });

    it('uploads a file with entryId after verifying entry exists', async () => {
      entryRepository.findOne.mockResolvedValue({ id: 10, userId: 1 });
      attachmentRepository.create.mockReturnValue(mockAttachment);
      attachmentRepository.save.mockResolvedValue(mockAttachment);
      mockSend.mockResolvedValue({});

      const result = await service.upload(1, mockFile, 10);

      expect(entryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 10, userId: 1 },
      });
      expect(result).toEqual(mockAttachment);
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(service.upload(1, null as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for disallowed mimetype', async () => {
      const badFile = { ...mockFile, mimetype: 'application/exe' } as Express.Multer.File;
      await expectApiError(service.upload(1, badFile), BadRequestException, 'ATTACHMENT_TYPE_NOT_ALLOWED');
    });

    it('throws BadRequestException when file exceeds size limit', async () => {
      const bigFile = { ...mockFile, size: 10 * 1024 * 1024 } as Express.Multer.File;
      await expectApiError(service.upload(1, bigFile), BadRequestException, 'ATTACHMENT_TOO_LARGE');
    });

    it('throws NotFoundException when entryId does not belong to user', async () => {
      entryRepository.findOne.mockResolvedValue(null);
      await expect(service.upload(1, mockFile, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOwnedAttachment', () => {
    it('returns only an attachment matched to the user', async () => {
      attachmentRepository.findOne.mockResolvedValue(mockAttachment);

      await expect(service.getOwnedAttachment(1, 1)).resolves.toBe(mockAttachment);
      expect(attachmentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
        relations: { entry: true },
        withDeleted: true,
      });
    });

    it('does not disclose attachments outside the user scope', async () => {
      attachmentRepository.findOne.mockResolvedValue(null);

      await expect(service.getOwnedAttachment(2, 1)).rejects.toThrow(NotFoundException);
    });

    it('refuses an attachment of a sealed time capsule until it opens', async () => {
      attachmentRepository.findOne.mockResolvedValue({ ...mockAttachment, entry: { sealedUntil: new Date('2030-01-01T08:00:00Z') } });
      await expect(service.getOwnedAttachment(1, 1)).rejects.toMatchObject({ response: { code: 'ENTRY_SEALED' } });

      attachmentRepository.findOne.mockResolvedValue({ ...mockAttachment, entry: { sealedUntil: null } });
      await expect(service.getOwnedAttachment(1, 1)).resolves.toMatchObject({ id: mockAttachment.id });
    });
  });

  describe('linkToEntry', () => {
    it('links an attachment to an entry', async () => {
      const unlinked = { ...mockAttachment, entryId: null };
      const linked = { ...mockAttachment, entryId: 10 };
      attachmentRepository.findOne.mockResolvedValue(unlinked);
      entryRepository.findOne.mockResolvedValue({ id: 10, userId: 1 });
      attachmentRepository.save.mockResolvedValue(linked);

      const result = await service.linkToEntry(1, 1, 10);

      expect(unlinked.entryId).toBe(10);
      expect(attachmentRepository.save).toHaveBeenCalledWith(unlinked);
      expect(result).toEqual(linked);
    });

    it('throws NotFoundException when attachment not found', async () => {
      attachmentRepository.findOne.mockResolvedValue(null);
      await expect(service.linkToEntry(1, 999, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when entry not found', async () => {
      attachmentRepository.findOne.mockResolvedValue(mockAttachment);
      entryRepository.findOne.mockResolvedValue(null);
      await expect(service.linkToEntry(1, 1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkMultipleToEntry', () => {
    it('links multiple attachments to an entry', async () => {
      const att1 = { ...mockAttachment, id: 1, entryId: null };
      const att2 = { ...mockAttachment, id: 2, entryId: null };

      attachmentRepository.findOne.mockResolvedValueOnce(att1).mockResolvedValueOnce(att2);
      entryRepository.findOne.mockResolvedValue({ id: 10, userId: 1 });
      attachmentRepository.save.mockResolvedValue(mockAttachment);

      await service.linkMultipleToEntry(1, [1, 2], 10);

      expect(attachmentRepository.findOne).toHaveBeenCalledTimes(2);
      expect(attachmentRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFileStream', () => {
    it('returns a stream and content type from S3', async () => {
      const mockStream = { pipe: jest.fn() };
      mockSend.mockResolvedValue({
        Body: mockStream,
        ContentType: 'image/jpeg',
      });

      const result = await service.getFileStream('abc-uuid.jpg');

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ _type: 'GetObject' }));
      expect(result.stream).toBe(mockStream);
      expect(result.contentType).toBe('image/jpeg');
    });

    it('defaults content type to application/octet-stream', async () => {
      const mockStream = { pipe: jest.fn() };
      mockSend.mockResolvedValue({
        Body: mockStream,
        ContentType: undefined,
      });

      const result = await service.getFileStream('abc-uuid.jpg');
      expect(result.contentType).toBe('application/octet-stream');
    });
  });

  describe('findOwnedFile', () => {
    it('finds a file, or a video poster frame, only for the user who owns its attachment', async () => {
      attachmentRepository.findOne.mockResolvedValue(mockAttachment);

      const result = await service.findOwnedFile(1, 'abc-uuid.jpg');

      expect(attachmentRepository.findOne).toHaveBeenCalledWith({
        where: [
          { storedFilename: 'abc-uuid.jpg', userId: 1 },
          { posterFilename: 'abc-uuid.jpg', userId: 1 },
        ],
        relations: { entry: true },
        withDeleted: true,
      });
      expect(result).toEqual({
        key: 'abc-uuid.jpg',
        contentType: 'image/jpeg',
        originalFilename: 'photo.jpg',
        inline: true,
        size: 1024,
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('serves a poster frame as an inline JPEG named after its video', async () => {
      attachmentRepository.findOne.mockResolvedValue({
        ...mockAttachment,
        originalFilename: 'beach.day.mov',
        mimetype: 'video/quicktime',
        storedFilename: 'video.mov',
        posterFilename: 'poster.jpg',
        posterSize: 321,
      });

      await expect(service.findOwnedFile(1, 'poster.jpg')).resolves.toEqual({
        key: 'poster.jpg',
        contentType: 'image/jpeg',
        originalFilename: 'beach.day-poster.jpg',
        inline: true,
        size: 321,
      });
      await expect(service.findOwnedFile(1, 'video.mov')).resolves.toMatchObject({
        contentType: 'video/quicktime',
        inline: true,
        size: 1024,
      });
    });

    it('answers missing for another user', async () => {
      attachmentRepository.findOne.mockResolvedValue(null);

      await expect(service.findOwnedFile(2, 'abc-uuid.jpg')).rejects.toThrow(NotFoundException);
    });

    it('answers missing for a file of a sealed time capsule', async () => {
      attachmentRepository.findOne.mockResolvedValue({ ...mockAttachment, entry: { sealedUntil: new Date('2030-01-01T08:00:00Z') } });

      await expect(service.findOwnedFile(1, 'abc-uuid.jpg')).rejects.toThrow(NotFoundException);
    });

    it('marks SVG and text as downloads and unknown types as octet-stream', async () => {
      attachmentRepository.findOne.mockResolvedValueOnce({
        ...mockAttachment,
        mimetype: 'image/svg+xml',
      });
      await expect(service.findOwnedFile(1, 'a.svg')).resolves.toMatchObject({
        contentType: 'image/svg+xml',
        inline: false,
      });

      attachmentRepository.findOne.mockResolvedValueOnce({ ...mockAttachment, mimetype: 'text/plain' });
      await expect(service.findOwnedFile(1, 'a.txt')).resolves.toMatchObject({ inline: false });

      attachmentRepository.findOne.mockResolvedValueOnce({ ...mockAttachment, mimetype: 'text/html' });
      await expect(service.findOwnedFile(1, 'a.html')).resolves.toMatchObject({
        contentType: 'application/octet-stream',
        inline: false,
      });
    });
  });

  describe('openFile', () => {
    it('reads the whole object, or only the requested bytes', async () => {
      const body = Readable.from(['x']);
      mockSend.mockResolvedValue({ Body: body, ContentLength: 1 });

      await expect(service.openFile('clip.mp4')).resolves.toEqual({ stream: body, contentLength: 1 });
      expect(mockSend).toHaveBeenLastCalledWith(expect.not.objectContaining({ Range: expect.anything() }));

      await service.openFile('clip.mp4', { start: 10, end: 19 });
      expect(mockSend).toHaveBeenLastCalledWith(
        expect.objectContaining({ _type: 'GetObject', Key: 'clip.mp4', Range: 'bytes=10-19' }),
      );
    });
  });

  describe('getFileBuffer', () => {
    it('collects a storage stream into a bounded buffer', async () => {
      mockSend.mockResolvedValue({
        Body: Readable.from([Buffer.from('hello '), Buffer.from('world')]),
        ContentType: 'image/png',
      });

      await expect(service.getFileBuffer('image.png', 20)).resolves.toEqual(
        Buffer.from('hello world'),
      );
    });

    it('rejects and destroys a stream that exceeds the requested limit', async () => {
      const stream = Readable.from([Buffer.from('too large')]);
      const destroySpy = jest.spyOn(stream, 'destroy');
      mockSend.mockResolvedValue({ Body: stream, ContentType: 'image/png' });

      await expect(service.getFileBuffer('image.png', 3)).rejects.toThrow('export size limit');
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes an attachment from S3 and database', async () => {
      attachmentRepository.findOne.mockResolvedValue(mockAttachment);
      mockSend.mockResolvedValue({});

      const result = await service.delete(1, 1);

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ _type: 'DeleteObject' }));
      expect(attachmentRepository.remove).toHaveBeenCalledWith(mockAttachment);
      expect(result).toEqual({ success: true });
    });

    it('still removes from database if S3 delete fails', async () => {
      attachmentRepository.findOne.mockResolvedValue(mockAttachment);
      mockSend.mockRejectedValue(new Error('S3 error'));

      const result = await service.delete(1, 1);

      expect(attachmentRepository.remove).toHaveBeenCalledWith(mockAttachment);
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when attachment not found', async () => {
      attachmentRepository.findOne.mockResolvedValue(null);
      await expect(service.delete(1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteByEntryId', () => {
    it('deletes all attachments for an entry, with video poster frames, from S3 and database', async () => {
      const att1 = { ...mockAttachment, id: 1 };
      const att2 = { ...mockAttachment, id: 2, storedFilename: 'def-uuid.mp4', posterFilename: 'def-poster.jpg' };
      attachmentRepository.find.mockResolvedValue([att1, att2]);
      mockSend.mockResolvedValue({});

      await service.deleteByEntryId(1, 10);

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend).toHaveBeenLastCalledWith(expect.objectContaining({ Key: 'def-poster.jpg', _type: 'DeleteObject' }));
      expect(attachmentRepository.remove).toHaveBeenCalledWith([att1, att2]);
    });
  });

  describe('removeStoredFiles', () => {
    it('deletes each blob, keeps going when one delete fails, and returns the keys that failed', async () => {
      const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      mockSend.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({});

      await expect(service.removeStoredFiles(['first.jpg', 'second.m4a'])).resolves.toEqual(['first.jpg']);

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenLastCalledWith(expect.objectContaining({ Key: 'second.m4a', _type: 'DeleteObject' }));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('first.jpg'));
    });
  });
});

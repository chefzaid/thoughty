import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { Attachment, Entry } from '@/database/entities';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'PutObject' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'GetObject' })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'DeleteObject' })),
  CreateBucketCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'CreateBucket' })),
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
      mockSend
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce({});

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

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'PutObject' }),
      );
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
      await expect(service.upload(1, badFile)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file exceeds size limit', async () => {
      const bigFile = { ...mockFile, size: 10 * 1024 * 1024 } as Express.Multer.File;
      await expect(service.upload(1, bigFile)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when entryId does not belong to user', async () => {
      entryRepository.findOne.mockResolvedValue(null);
      await expect(service.upload(1, mockFile, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByEntry', () => {
    it('returns attachments for a given entry', async () => {
      attachmentRepository.find.mockResolvedValue([mockAttachment]);

      const result = await service.getByEntry(1, 10);

      expect(attachmentRepository.find).toHaveBeenCalledWith({
        where: { userId: 1, entryId: 10 },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual([mockAttachment]);
    });

    it('returns empty array when no attachments found', async () => {
      attachmentRepository.find.mockResolvedValue([]);
      const result = await service.getByEntry(1, 10);
      expect(result).toEqual([]);
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

      attachmentRepository.findOne
        .mockResolvedValueOnce(att1)
        .mockResolvedValueOnce(att2);
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

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'GetObject' }),
      );
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

  describe('delete', () => {
    it('deletes an attachment from S3 and database', async () => {
      attachmentRepository.findOne.mockResolvedValue(mockAttachment);
      mockSend.mockResolvedValue({});

      const result = await service.delete(1, 1);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'DeleteObject' }),
      );
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
    it('deletes all attachments for an entry from S3 and database', async () => {
      const att1 = { ...mockAttachment, id: 1 };
      const att2 = { ...mockAttachment, id: 2, storedFilename: 'def-uuid.jpg' };
      attachmentRepository.find.mockResolvedValue([att1, att2]);
      mockSend.mockResolvedValue({});

      await service.deleteByEntryId(1, 10);

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(attachmentRepository.remove).toHaveBeenCalledWith([att1, att2]);
    });
  });
});

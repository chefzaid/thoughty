import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReadStream } from 'node:fs';
import { lastValueFrom, of, throwError } from 'rxjs';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Attachment, Entry } from '@/database/entities';
import { AttachmentsService } from './attachments.service';
import { VideoPosterService } from './video-poster.service';
import { TempUploadCleanupInterceptor } from './temp-upload-cleanup.interceptor';
import { detectVideoType, maxSizeFor, MAX_FILE_SIZE, MAX_VIDEO_SIZE, storedKeysOf } from './attachment-media';
import { jpegOf, VIDEO_HEADS } from './video-fixtures.test-helpers';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'PutObject' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'GetObject' })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'DeleteObject' })),
  CreateBucketCommand: jest.fn(),
  HeadBucketCommand: jest.fn(),
}));

describe('video attachments', () => {
  let attachments: AttachmentsService;
  let posters: VideoPosterService;
  const attachmentRepository = {
    create: jest.fn((row: Partial<Attachment>) => row),
    save: jest.fn((row: Partial<Attachment>) => Promise.resolve({ id: 5, ...row })),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };
  const video = {
    id: 5,
    userId: 1,
    entryId: 10,
    originalFilename: 'beach.mp4',
    storedFilename: 'video.mp4',
    mimetype: 'video/mp4',
    size: 2048,
    posterFilename: null as string | null,
    posterSize: null as number | null,
    entry: { id: 10, sealedUntil: null },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
    const module = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        VideoPosterService,
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepository },
        { provide: getRepositoryToken(Entry), useValue: { findOne: jest.fn() } },
      ],
    }).compile();
    attachments = module.get(AttachmentsService);
    posters = module.get(VideoPosterService);
  });

  describe('detectVideoType', () => {
    it.each([
      ['mp4', 'video/mp4'],
      ['m4v', 'video/mp4'],
      ['quicktime', 'video/quicktime'],
      ['legacyQuicktime', 'video/quicktime'],
      ['webm', 'video/webm'],
    ] as const)('recognizes %s', (kind, type) => {
      expect(detectVideoType(VIDEO_HEADS[kind])).toBe(type);
    });

    it.each(['matroska', 'heic', 'm4a'] as const)('refuses %s, which shares a container but is no browser video', (kind) => {
      expect(detectVideoType(VIDEO_HEADS[kind])).toBeNull();
    });

    it('refuses bytes too short or of another kind', () => {
      expect(detectVideoType(Buffer.from('ftyp'))).toBeNull();
      expect(detectVideoType(Buffer.from('<html><body>not a video</body></html>'))).toBeNull();
      expect(detectVideoType(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0]))).toBeNull();
    });
  });

  it('gives videos their own size limit and lists every storage key', () => {
    expect(maxSizeFor('video/webm')).toBe(MAX_VIDEO_SIZE);
    expect(maxSizeFor('image/png')).toBe(MAX_FILE_SIZE);
    expect(storedKeysOf([{ storedFilename: 'a.png' }, { storedFilename: 'b.mp4', posterFilename: 'b.jpg' }])).toEqual([
      'a.png',
      'b.mp4',
      'b.jpg',
    ]);
  });

  describe('upload', () => {
    let folder: string;

    beforeEach(async () => {
      folder = await mkdtemp(join(tmpdir(), 'thoughty-video-spec-'));
    });

    afterEach(async () => {
      await rm(folder, { recursive: true, force: true });
    });

    it('streams a video from its temporary file and stores the type its bytes show', async () => {
      const path = join(folder, 'upload');
      await writeFile(path, Buffer.concat([VIDEO_HEADS.quicktime, Buffer.alloc(100)]));
      const file = { originalname: 'IMG_0001.MOV', mimetype: 'video/mp4', size: 164, path } as Express.Multer.File;

      const saved = await attachments.upload(1, file);

      const [put] = mockSend.mock.calls[0] as [{ Body: unknown; ContentLength: number; ContentType: string; Key: string }];
      expect(put.Body).toBeInstanceOf(ReadStream);
      (put.Body as ReadStream).destroy();
      expect(put).toEqual(expect.objectContaining({ ContentLength: 164, ContentType: 'video/quicktime' }));
      expect(put.Key).toMatch(/^[0-9a-f-]{36}\.mov$/);
      expect(saved).toEqual(expect.objectContaining({ mimetype: 'video/quicktime', size: 164 }));
    });

    it('takes a video over 5 MB but under 50 MB from memory', async () => {
      const file = {
        originalname: 'clip.webm',
        mimetype: 'video/webm',
        size: 20 * 1024 * 1024,
        buffer: VIDEO_HEADS.webm,
      } as Express.Multer.File;

      await expect(attachments.upload(1, file)).resolves.toEqual(expect.objectContaining({ mimetype: 'video/webm' }));
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ Body: VIDEO_HEADS.webm, ContentType: 'video/webm' }));
    });

    it('refuses a file that claims to be a video without its bytes, before storing anything', async () => {
      const file = {
        originalname: 'page.mp4',
        mimetype: 'video/mp4',
        size: 30,
        buffer: Buffer.from('<script>alert(1)</script>'),
      } as Express.Multer.File;

      await expectApiError(attachments.upload(1, file), BadRequestException, 'ATTACHMENT_CONTENT_MISMATCH');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('keeps the 5 MB limit for other types and 50 MB for videos', async () => {
      const big = { originalname: 'scan.png', mimetype: 'image/png', size: MAX_FILE_SIZE + 1, buffer: Buffer.alloc(1) };
      await expectApiError(attachments.upload(1, big as Express.Multer.File), BadRequestException, 'ATTACHMENT_TOO_LARGE');
      const huge = { ...big, originalname: 'long.mp4', mimetype: 'video/mp4', size: MAX_VIDEO_SIZE + 1 };
      await expectApiError(attachments.upload(1, huge as Express.Multer.File), BadRequestException, 'ATTACHMENT_TOO_LARGE');
    });
  });

  describe('setPoster', () => {
    const poster = (buffer: Buffer, mimetype = 'image/jpeg') =>
      ({ buffer, mimetype, size: buffer.length, originalname: 'poster.jpg' }) as Express.Multer.File;

    it('stores a JPEG drawn from the video on its row and deletes the frame it replaces', async () => {
      attachmentRepository.findOne.mockResolvedValue({ ...video, posterFilename: 'old.jpg', posterSize: 10 });

      const saved = await posters.setPoster(1, 5, poster(jpegOf(960, 540)));

      expect(attachmentRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 5, userId: 1 } }));
      const [put, removed] = mockSend.mock.calls as [[{ Key: string; ContentType: string }], [{ Key: string; _type: string }]];
      expect(put[0]).toEqual(expect.objectContaining({ _type: 'PutObject', ContentType: 'image/jpeg' }));
      expect(saved.posterFilename).toBe(put[0].Key);
      expect(saved.posterFilename).toMatch(/^[0-9a-f-]{36}\.jpg$/);
      expect(saved.posterSize).toBe(jpegOf(960, 540).length);
      expect(removed[0]).toEqual({ Bucket: expect.any(String), Key: 'old.jpg', _type: 'DeleteObject' });
    });

    it('refuses a missing file, another writer’s video, a picture or a sealed capsule’s video', async () => {
      await expectApiError(posters.setPoster(1, 5, undefined), BadRequestException, 'ATTACHMENT_FILE_MISSING');

      attachmentRepository.findOne.mockResolvedValueOnce(null);
      await expectApiError(posters.setPoster(2, 5, poster(jpegOf(10, 10))), NotFoundException, 'ATTACHMENT_NOT_FOUND');

      attachmentRepository.findOne.mockResolvedValueOnce({ ...video, mimetype: 'image/png' });
      await expectApiError(posters.setPoster(1, 5, poster(jpegOf(10, 10))), BadRequestException, 'ATTACHMENT_NOT_VIDEO');

      attachmentRepository.findOne.mockResolvedValueOnce({ ...video, entry: { id: 10, sealedUntil: new Date('2040-01-01') } });
      await expectApiError(posters.setPoster(1, 5, poster(jpegOf(10, 10))), ConflictException, 'ENTRY_SEALED');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('refuses a frame that is not a JPEG by type, size, bytes or dimensions', async () => {
      attachmentRepository.findOne.mockResolvedValue(video);

      await expectApiError(posters.setPoster(1, 5, poster(jpegOf(10, 10), 'image/png')), BadRequestException, 'ATTACHMENT_TYPE_NOT_ALLOWED');
      const large = { ...poster(jpegOf(10, 10)), size: 2 * 1024 * 1024 };
      await expectApiError(posters.setPoster(1, 5, large), BadRequestException, 'ATTACHMENT_TOO_LARGE');
      await expectApiError(posters.setPoster(1, 5, poster(Buffer.from('GIF89a......'))), BadRequestException, 'ATTACHMENT_CONTENT_MISMATCH');
      await expectApiError(posters.setPoster(1, 5, poster(jpegOf(8000, 100))), BadRequestException, 'ATTACHMENT_CONTENT_MISMATCH');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  it('deletes a video with its poster frame', async () => {
    attachmentRepository.findOne.mockResolvedValue({ ...video, posterFilename: 'frame.jpg', posterSize: 10 });

    await attachments.delete(1, 5);

    expect(mockSend.mock.calls.map(([command]) => (command as { Key: string }).Key)).toEqual(['video.mp4', 'frame.jpg']);
  });

  describe('TempUploadCleanupInterceptor', () => {
    const contextFor = (file?: { path?: string }) =>
      ({ switchToHttp: () => ({ getRequest: () => ({ file }) }) }) as never;

    it('deletes the temporary file after an answer or an error, and only warns when it is already gone', async () => {
      const folder = await mkdtemp(join(tmpdir(), 'thoughty-cleanup-spec-'));
      const path = join(folder, 'upload');
      await writeFile(path, 'x');
      const interceptor = new TempUploadCleanupInterceptor();
      const warn = jest.spyOn((interceptor as unknown as { logger: { warn: () => void } }).logger, 'warn').mockImplementation();

      await lastValueFrom(interceptor.intercept(contextFor({ path }), { handle: () => of('done') }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      await expect(rm(path)).rejects.toThrow();

      await expect(
        lastValueFrom(interceptor.intercept(contextFor({ path }), { handle: () => throwError(() => new Error('refused')) })),
      ).rejects.toThrow('refused');
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(path));

      await lastValueFrom(interceptor.intercept(contextFor({ buffer: Buffer.alloc(1) } as never), { handle: () => of('memory') }));
      await rm(folder, { recursive: true, force: true });
    });
  });
});

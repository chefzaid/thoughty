import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment, Entry } from '@/database/entities';
import { assertEntryNotSealed } from '@/modules/time-capsules/time-capsule.guard';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import type { ByteRange } from '@/common/utils';
import {
  ALLOWED_MIMETYPES,
  INLINE_MIMETYPES,
  VIDEO_SIGNATURE_BYTES,
  detectVideoType,
  isVideoMimetype,
  maxSizeFor,
  storedKeysOf,
} from './attachment-media';

/** A stored file its owner may read: an attachment's file or a video's poster frame. */
export interface OwnedAttachmentFile {
  key: string;
  contentType: string;
  originalFilename: string;
  inline: boolean;
  /** Bytes, as recorded at upload. */
  size: number;
}

/** A stored file opened for reading, whole or one byte range of it. */
export interface OpenedAttachmentFile {
  stream: Readable;
  contentLength?: number;
}

/** The first bytes of an upload, from memory or from the temporary file the upload route writes. */
async function readHead(file: Express.Multer.File, bytes: number): Promise<Buffer> {
  if (file.buffer) {
    return file.buffer.subarray(0, bytes);
  }
  const handle = await open(file.path, 'r');
  try {
    const head = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(head, 0, bytes, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** A poster frame is named after its video, as a JPEG. */
function posterName(originalFilename: string): string {
  const dot = originalFilename.lastIndexOf('.');
  return `${dot > 0 ? originalFilename.slice(0, dot) : originalFilename}-poster.jpg`;
}

@Injectable()
export class AttachmentsService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {
    this.bucket = process.env.S3_BUCKET || 'thoughty-attachments';
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created S3 bucket: ${this.bucket}`);
      } catch (createErr) {
        this.logger.warn(`Could not create S3 bucket: ${(createErr as Error).message}`);
      }
    }
  }

  /** Rejects a missing file, a type outside the allowlist, or a file over its type's size limit (50 MB for videos, 5 MB otherwise). */
  assertUploadable(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) {
      throw apiError(BadRequestException, 'ATTACHMENT_FILE_MISSING');
    }

    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw apiError(
        BadRequestException,
        'ATTACHMENT_TYPE_NOT_ALLOWED',
        `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIMETYPES.join(', ')}`,
      );
    }

    const maxSize = maxSizeFor(file.mimetype);
    if (file.size > maxSize) {
      throw apiError(
        BadRequestException,
        'ATTACHMENT_TOO_LARGE',
        `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * The type to store: a video's comes from its bytes (an MP4, QuickTime or WebM signature), never
   * from the type the browser declared, and a file that claims to be a video without being one is refused.
   */
  private async storedTypeOf(file: Express.Multer.File): Promise<string> {
    if (!isVideoMimetype(file.mimetype)) {
      return file.mimetype;
    }
    const detected = detectVideoType(await readHead(file, VIDEO_SIGNATURE_BYTES));
    if (!detected) {
      throw apiError(BadRequestException, 'ATTACHMENT_CONTENT_MISMATCH');
    }
    return detected;
  }

  /** Stores a file from memory, or streams it from the temporary file of a disk upload. */
  async putObject(key: string, file: Express.Multer.File, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer ?? createReadStream(file.path),
        ContentLength: file.size,
        ContentType: contentType,
      }),
    );
  }

  async upload(userId: number, file: Express.Multer.File, entryId?: number): Promise<Attachment> {
    this.assertUploadable(file);
    const mimetype = await this.storedTypeOf(file);

    if (entryId) {
      const entry = await this.entryRepository.findOne({
        where: { id: entryId, userId },
      });
      if (!entry) {
        throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
      }
    }

    const ext = extname(file.originalname).toLowerCase();
    const storedFilename = `${randomUUID()}${ext}`;

    await this.putObject(storedFilename, file, mimetype);

    const attachment = this.attachmentRepository.create({
      userId,
      entryId: entryId || null,
      originalFilename: file.originalname,
      storedFilename,
      mimetype,
      size: file.size,
    });

    return this.attachmentRepository.save(attachment);
  }

  async linkToEntry(userId: number, attachmentId: number, entryId: number): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, userId },
    });
    if (!attachment) {
      throw apiError(NotFoundException, 'ATTACHMENT_NOT_FOUND');
    }

    const entry = await this.entryRepository.findOne({
      where: { id: entryId, userId },
    });
    if (!entry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    attachment.entryId = entryId;
    return this.attachmentRepository.save(attachment);
  }

  async linkMultipleToEntry(
    userId: number,
    attachmentIds: number[],
    entryId: number,
  ): Promise<void> {
    for (const attachmentId of attachmentIds) {
      await this.linkToEntry(userId, attachmentId, entryId);
    }
  }

  async getFileStream(storedFilename: string): Promise<{ stream: Readable; contentType: string }> {
    const result = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storedFilename,
      }),
    );
    return {
      stream: result.Body as Readable,
      contentType: result.ContentType || 'application/octet-stream',
    };
  }

  /**
   * A stored file for the user who owns its attachment: the attachment's own file, or the poster
   * frame of their video. Attachments are never shown in the public feed, so nobody else may read
   * them; a key that is not the caller's answers as missing, as does a file of a sealed time capsule
   * until the capsule opens. The type comes from the attachment row (limited to the upload
   * allowlist), not from storage; a poster frame is always a JPEG.
   */
  async findOwnedFile(userId: number, key: string): Promise<OwnedAttachmentFile> {
    const attachment = await this.attachmentRepository.findOne({
      where: [
        { storedFilename: key, userId },
        { posterFilename: key, userId },
      ],
      relations: { entry: true },
      withDeleted: true,
    });
    if (!attachment || attachment.entry?.sealedUntil) {
      throw apiError(NotFoundException, 'ATTACHMENT_FILE_NOT_FOUND');
    }
    if (attachment.posterFilename === key) {
      return {
        key,
        contentType: 'image/jpeg',
        originalFilename: posterName(attachment.originalFilename),
        inline: true,
        size: attachment.posterSize ?? 0,
      };
    }
    const contentType = ALLOWED_MIMETYPES.includes(attachment.mimetype)
      ? attachment.mimetype
      : 'application/octet-stream';
    return {
      key,
      contentType,
      originalFilename: attachment.originalFilename,
      inline: INLINE_MIMETYPES.has(contentType),
      size: attachment.size,
    };
  }

  /** Opens a stored file, or only the bytes of `range`, as a video player asks for when it seeks. */
  async openFile(key: string, range?: ByteRange): Promise<OpenedAttachmentFile> {
    const result = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      }),
    );
    return { stream: result.Body as Readable, contentLength: result.ContentLength };
  }

  /** One of the writer's attachments, to work on; one of a sealed time capsule is refused until the capsule opens. */
  async getOwnedAttachment(userId: number, attachmentId: number): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, userId },
      relations: { entry: true },
      withDeleted: true,
    });
    if (!attachment) {
      throw apiError(NotFoundException, 'ATTACHMENT_NOT_FOUND');
    }
    if (attachment.entry) {
      assertEntryNotSealed(attachment.entry);
    }
    return attachment;
  }

  save(attachment: Attachment): Promise<Attachment> {
    return this.attachmentRepository.save(attachment);
  }

  async getFileBuffer(storedFilename: string, maxBytes: number): Promise<Buffer> {
    const { stream } = await this.getFileStream(storedFilename);
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        stream.destroy();
        throw apiError(BadRequestException, 'ATTACHMENT_EXPORT_TOO_LARGE');
      }
      chunks.push(buffer);
    }

    return Buffer.concat(chunks, totalBytes);
  }

  async delete(userId: number, attachmentId: number): Promise<{ success: boolean }> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, userId },
    });
    if (!attachment) {
      throw apiError(NotFoundException, 'ATTACHMENT_NOT_FOUND');
    }

    await this.removeStoredFiles(storedKeysOf([attachment]));
    await this.attachmentRepository.remove(attachment);
    return { success: true };
  }

  async deleteByEntryId(userId: number, entryId: number): Promise<void> {
    const attachments = await this.attachmentRepository.find({
      where: { userId, entryId },
    });

    await this.removeStoredFiles(storedKeysOf(attachments));
    await this.attachmentRepository.remove(attachments);
  }

  /**
   * Deletes blobs whose attachment rows are already gone, such as the files of entries removed
   * from the recycle bin. A failed delete is logged and skipped so the others still go; the keys
   * that could not be deleted are returned.
   */
  async removeStoredFiles(storedFilenames: string[]): Promise<string[]> {
    const failed: string[] = [];
    for (const storedFilename of storedFilenames) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: storedFilename,
          }),
        );
      } catch (err) {
        this.logger.warn(`Could not delete S3 object ${storedFilename}: ${(err as Error).message}`);
        failed.push(storedFilename);
      }
    }
    return failed;
  }
}

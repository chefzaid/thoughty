import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment, Entry } from '@/database/entities';
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
import type { Readable } from 'node:stream';

const ALLOWED_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

  async upload(
    userId: number,
    file: Express.Multer.File,
    entryId?: number,
  ): Promise<Attachment> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIMETYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (entryId) {
      const entry = await this.entryRepository.findOne({
        where: { id: entryId, userId },
      });
      if (!entry) {
        throw new NotFoundException('Entry not found');
      }
    }

    const ext = extname(file.originalname).toLowerCase();
    const storedFilename = `${randomUUID()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storedFilename,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const attachment = this.attachmentRepository.create({
      userId,
      entryId: entryId || null,
      originalFilename: file.originalname,
      storedFilename,
      mimetype: file.mimetype,
      size: file.size,
    });

    return this.attachmentRepository.save(attachment);
  }

  async getByEntry(userId: number, entryId: number): Promise<Attachment[]> {
    return this.attachmentRepository.find({
      where: { userId, entryId },
      order: { createdAt: 'ASC' },
    });
  }

  async linkToEntry(
    userId: number,
    attachmentId: number,
    entryId: number,
  ): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, userId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const entry = await this.entryRepository.findOne({
      where: { id: entryId, userId },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
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

  async delete(userId: number, attachmentId: number): Promise<{ success: boolean }> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, userId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: attachment.storedFilename,
        }),
      );
    } catch (err) {
      this.logger.warn(`Could not delete S3 object ${attachment.storedFilename}: ${(err as Error).message}`);
    }

    await this.attachmentRepository.remove(attachment);
    return { success: true };
  }

  async deleteByEntryId(userId: number, entryId: number): Promise<void> {
    const attachments = await this.attachmentRepository.find({
      where: { userId, entryId },
    });

    for (const attachment of attachments) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: attachment.storedFilename,
          }),
        );
      } catch (err) {
        this.logger.warn(`Could not delete S3 object ${attachment.storedFilename}: ${(err as Error).message}`);
      }
    }

    await this.attachmentRepository.remove(attachments);
  }
}

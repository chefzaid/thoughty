import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { apiError } from '@/common/errors';
import { imageDimensionsAreBounded, readPassiveImageDimensions } from '@/common/utils';
import type { Attachment } from '@/database/entities';
import { AttachmentsService } from './attachments.service';
import { MAX_POSTER_DIMENSION, MAX_POSTER_SIZE, isVideoMimetype } from './attachment-media';

/**
 * Stores the poster frame of a video attachment: a small JPEG the browser draws from the video when
 * it is attached (the server never decodes video). It is kept on the video's row, read under the
 * same ownership rules as the video, and deleted with it.
 */
@Injectable()
export class VideoPosterService {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  async setPoster(userId: number, attachmentId: number, file: Express.Multer.File | undefined): Promise<Attachment> {
    if (!file) {
      throw apiError(BadRequestException, 'ATTACHMENT_FILE_MISSING');
    }
    const attachment = await this.attachmentsService.getOwnedAttachment(userId, attachmentId);
    if (!isVideoMimetype(attachment.mimetype)) {
      throw apiError(BadRequestException, 'ATTACHMENT_NOT_VIDEO');
    }
    if (file.mimetype !== 'image/jpeg') {
      throw apiError(BadRequestException, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'A poster frame must be a JPEG image');
    }
    if (file.size > MAX_POSTER_SIZE) {
      throw apiError(
        BadRequestException,
        'ATTACHMENT_TOO_LARGE',
        `File size exceeds maximum of ${MAX_POSTER_SIZE / 1024 / 1024}MB`,
      );
    }
    const dimensions = readPassiveImageDimensions(file.buffer, 'image/jpeg');
    if (!imageDimensionsAreBounded(dimensions, MAX_POSTER_DIMENSION, MAX_POSTER_DIMENSION * MAX_POSTER_DIMENSION)) {
      throw apiError(BadRequestException, 'ATTACHMENT_CONTENT_MISMATCH');
    }

    const previous = attachment.posterFilename;
    const posterFilename = `${randomUUID()}.jpg`;
    await this.attachmentsService.putObject(posterFilename, file, 'image/jpeg');
    attachment.posterFilename = posterFilename;
    attachment.posterSize = file.size;
    const saved = await this.attachmentsService.save(attachment);
    if (previous) {
      await this.attachmentsService.removeStoredFiles([previous]);
    }
    return saved;
  }
}

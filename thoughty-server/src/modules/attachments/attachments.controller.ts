import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Headers,
  NotFoundException,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { tmpdir } from 'node:os';
import { apiError } from '@/common/errors';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { diskStorage, memoryStorage } from 'multer';
import { Response } from 'express';
import { parseByteRange } from '@/common/utils';
import { AttachmentsService, OwnedAttachmentFile } from './attachments.service';
import { VideoPosterService } from './video-poster.service';
import { TempUploadCleanupInterceptor } from './temp-upload-cleanup.interceptor';
import { MAX_POSTER_SIZE, MAX_VIDEO_SIZE } from './attachment-media';
import {
  LinkAttachmentDto,
  AudioTranscriptionResponseDto,
  AttachmentRecordResponseDto,
  toAttachmentRecordResponse,
} from './dto';
import { SuccessResponseDto } from '@/common/dto';
import { AudioTranscriptionService } from './audio-transcription.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { MULTIPART_FIELD_LIMITS } from '@/common/multipart-limits';

/** `416 Range Not Satisfiable`, which Nest has no exception class for. */
export class RangeNotSatisfiableException extends HttpException {
  constructor(objectOrError?: object) {
    super(
      objectOrError ?? { statusCode: HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, message: 'Range Not Satisfiable' },
      HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
    );
  }
}

/** Builds a Content-Disposition header whose filename cannot break out of the header value. */
function contentDisposition(inline: boolean, originalFilename: string): string {
  const fallback = originalFilename.replace(/[^\w.\- ]/g, '_').slice(0, 150) || 'attachment';
  const encoded = encodeURIComponent(originalFilename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly audioTranscriptionService: AudioTranscriptionService,
    private readonly videoPosterService: VideoPosterService,
  ) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload a file attachment',
    description:
      'Images, audio, PDF and text up to 5 MB; MP4, WebM and QuickTime videos up to 50 MB, recognized by their bytes. ' +
      'The file is written to a temporary file as it arrives (the size limit stops it there) and streamed to storage.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully', type: AttachmentRecordResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: tmpdir() }),
      limits: {
        ...MULTIPART_FIELD_LIMITS,
        fileSize: MAX_VIDEO_SIZE,
      },
    }),
    TempUploadCleanupInterceptor,
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: LinkAttachmentDto,
  ): Promise<AttachmentRecordResponseDto> {
    const attachment = await this.attachmentsService.upload(user.userId, file, dto.entryId);

    return toAttachmentRecordResponse(attachment);
  }

  @Post(':id/link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link an attachment to an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Attachment linked to entry', type: AttachmentRecordResponseDto })
  async linkToEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkAttachmentDto,
  ): Promise<AttachmentRecordResponseDto> {
    if (!dto.entryId) {
      throw apiError(NotFoundException, 'VALIDATION_FAILED', 'entryId is required');
    }
    const attachment = await this.attachmentsService.linkToEntry(user.userId, id, dto.entryId);
    return toAttachmentRecordResponse(attachment);
  }

  @Post(':id/poster')
  @ApiOperation({
    summary: "Store a video attachment's poster frame",
    description: 'A JPEG of at most 1 MB and 4096 pixels a side, drawn from the video by the browser; it replaces any earlier one.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Poster frame stored', type: AttachmentRecordResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { ...MULTIPART_FIELD_LIMITS, fields: 0, parts: 1, fileSize: MAX_POSTER_SIZE },
    }),
  )
  async setPoster(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AttachmentRecordResponseDto> {
    return toAttachmentRecordResponse(await this.videoPosterService.setPoster(user.userId, id, file));
  }

  @Post(':id/transcribe')
  @ApiOperation({ summary: 'Transcribe an audio attachment' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Audio attachment transcribed or cached transcript returned',
    type: AudioTranscriptionResponseDto,
  })
  async transcribe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AudioTranscriptionResponseDto> {
    return this.audioTranscriptionService.transcribe(user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Attachment deleted', type: SuccessResponseDto })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SuccessResponseDto> {
    return this.attachmentsService.delete(user.userId, id);
  }

  @Get('file/:filename')
  @ApiOperation({
    summary: 'Serve an attachment file',
    description: 'An attachment file or a video poster frame, to its owner. A single `Range: bytes=` range is answered with 206, as video players ask when they seek.',
  })
  @ApiParam({ name: 'filename', type: String })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 206, description: 'The requested byte range of the file' })
  @ApiResponse({ status: 404, description: 'File missing or not owned by the caller' })
  @ApiResponse({ status: 416, description: 'The requested range starts past the end of the file' })
  async serveFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('filename') filename: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ) {
    // Sanitize filename to prevent path traversal
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '');

    let file: OwnedAttachmentFile;
    try {
      file = await this.attachmentsService.findOwnedFile(user.userId, sanitized);
    } catch {
      throw apiError(NotFoundException, 'ATTACHMENT_FILE_NOT_FOUND');
    }

    const range = parseByteRange(rangeHeader, file.size);
    res.setHeader('Accept-Ranges', 'bytes');
    if (range === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${file.size}`);
      throw apiError(RangeNotSatisfiableException, 'ATTACHMENT_RANGE_NOT_SATISFIABLE');
    }

    let opened: Awaited<ReturnType<AttachmentsService['openFile']>>;
    try {
      opened = await this.attachmentsService.openFile(file.key, range ?? undefined);
    } catch {
      throw apiError(NotFoundException, 'ATTACHMENT_FILE_NOT_FOUND');
    }

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', contentDisposition(file.inline, file.originalFilename));
    if (!file.inline) {
      // Types such as SVG can carry script; never let one run if it is opened directly.
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    }
    if (range) {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
    } else if (opened.contentLength !== undefined) {
      res.setHeader('Content-Length', String(opened.contentLength));
    }
    opened.stream.on('error', () => res.destroy());
    opened.stream.pipe(res);
  }
}

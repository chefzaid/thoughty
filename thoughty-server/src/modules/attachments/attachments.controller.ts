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
  NotFoundException,
} from '@nestjs/common';
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
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { AttachmentsService, ServedAttachmentFile } from './attachments.service';
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
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully', type: AttachmentRecordResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        ...MULTIPART_FIELD_LIMITS,
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
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
  @ApiOperation({ summary: 'Serve an attachment file' })
  @ApiParam({ name: 'filename', type: String })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 404, description: 'File missing or not owned by the caller' })
  async serveFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Sanitize filename to prevent path traversal
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '');

    let file: ServedAttachmentFile;
    try {
      file = await this.attachmentsService.getOwnedFile(user.userId, sanitized);
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
    file.stream.on('error', () => res.destroy());
    file.stream.pipe(res);
  }
}

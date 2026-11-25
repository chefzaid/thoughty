import {
  Controller,
  Post,
  Put,
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
  ApiBody,
} from '@nestjs/swagger';
import { diskStorage, memoryStorage } from 'multer';
import { Response } from 'express';
import { AttachmentsService, OwnedAttachmentFile } from './attachments.service';
import { VideoPosterService } from './video-poster.service';
import { TempUploadCleanupInterceptor } from './temp-upload-cleanup.interceptor';
import { sendAttachmentFile } from './attachment-file-response';
import { MAX_POSTER_SIZE, MAX_VIDEO_SIZE } from './attachment-media';
import {
  LinkAttachmentDto,
  TranscribeAttachmentDto,
  StoreTranscriptDto,
  AudioTranscriptionResponseDto,
  AttachmentRecordResponseDto,
  toAttachmentRecordResponse,
} from './dto';
import { SuccessResponseDto } from '@/common/dto';
import { AudioTranscriptionService } from './audio-transcription.service';
import { LocalTranscriptService } from './local-transcript.service';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { MULTIPART_FIELD_LIMITS } from '@/common/multipart-limits';
import { RequireFeature } from '@/common/feature-flags';
import { ContentLockedException } from '@/common/content-lock';

export { RangeNotSatisfiableException } from './attachment-file-response';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly audioTranscriptionService: AudioTranscriptionService,
    private readonly videoPosterService: VideoPosterService,
    private readonly localTranscriptService: LocalTranscriptService,
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
  @RequireFeature('ai')
  @ApiOperation({
    summary: 'Transcribe an audio attachment',
    description:
      'The body is optional: a recording no entry holds yet names the diary it is for (`diaryId`), whose AI mode ' +
      'then applies; an entry’s recording follows its entry’s diary.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: TranscribeAttachmentDto, required: false })
  @ApiResponse({
    status: 201,
    description: 'Audio attachment transcribed or cached transcript returned',
    type: AudioTranscriptionResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'The attachment’s entry, or the diary the request names, has AI off (`DIARY_AI_OFF`), uses only the writer’s ' +
      'own model (`DIARY_AI_LOCAL`), or asks each time and `aiConsent` is not true (`DIARY_AI_CONSENT_REQUIRED`)',
  })
  @ApiResponse({ status: 404, description: 'Attachment not found, or the named diary is not the writer’s (`DIARY_NOT_FOUND`)' })
  async transcribe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TranscribeAttachmentDto,
  ): Promise<AudioTranscriptionResponseDto> {
    return this.audioTranscriptionService.transcribe(user.userId, id, dto.diaryId, dto.aiConsent);
  }

  @Put(':id/transcript')
  @RequireFeature('ai')
  @ApiOperation({
    summary: 'Store the transcript the writer’s device made of a recording',
    description:
      'For a recording on an entry of a diary set to the writer’s own model only: the browser transcribes the ' +
      'recording on the writer’s device with a speech-recognition library (the recording never leaves it for this) ' +
      'and this route keeps only the text, as a transcript Thoughty made is kept. No AI provider is called, and the ' +
      'writer’s model server is not either. It replaces any earlier transcript of the recording.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Transcript stored', type: AudioTranscriptionResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Not an audio recording (`ATTACHMENT_NOT_AUDIO`), an empty transcript, or one too long (`TRANSCRIPT_TOO_LONG`)',
  })
  @ApiResponse({
    status: 403,
    description: 'The recording is on no entry of a diary set to the writer’s own model (`TRANSCRIPT_LOCAL_DIARY_ONLY`)',
  })
  @ApiResponse({ status: 404, description: 'Attachment not found, or not the writer’s (`ATTACHMENT_NOT_FOUND`)' })
  @ApiResponse({ status: 423, description: 'The recording’s entry is locked and the request is not unlocked' })
  async storeTranscript(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StoreTranscriptDto,
  ): Promise<AudioTranscriptionResponseDto> {
    return this.localTranscriptService.store(user.userId, id, dto.transcript);
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
  @ApiResponse({ status: 423, description: 'The file’s entry is locked and the request is not unlocked' })
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
    } catch (error) {
      if (error instanceof ContentLockedException) throw error;
      throw apiError(NotFoundException, 'ATTACHMENT_FILE_NOT_FOUND');
    }

    await sendAttachmentFile(
      res,
      file,
      rangeHeader,
      (key, range) => this.attachmentsService.openFile(key, range),
      () => apiError(NotFoundException, 'ATTACHMENT_FILE_NOT_FOUND'),
    );
  }
}

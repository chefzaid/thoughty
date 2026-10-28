import { Controller, Get, Headers, NotFoundException, Param, ParseIntPipe, Res, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '@/common/decorators';
import { apiError } from '@/common/errors';
import { RATE_LIMITS, throttleDefault } from '@/common/rate-limit.constants';
import { AttachmentsService, contentDisposition, sendAttachmentFile } from '@/modules/attachments';
import { SharedContentResponseDto } from './dto';
import { SharedContentService } from './shared-content.service';
import { SharedResponseHeadersInterceptor } from './shared-response-headers.interceptor';

const TOKEN_PARAM = { name: 'token', type: String, description: 'The link’s token, as in `/s/<token>`' } as const;
const NOT_AVAILABLE = 'No such link, or it expired, ran out of views, was revoked, or its entry is in the recycle bin or sealed';

/**
 * A private share link as its reader opens it, without signing in. Every refusal is the same 404, so
 * the answers never tell whether a token ever existed.
 */
@ApiTags('Shared links')
@Public()
@UseInterceptors(SharedResponseHeadersInterceptor)
@Controller('shared')
export class SharedContentController {
  constructor(
    private readonly sharedContentService: SharedContentService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Get(':token')
  @Throttle(throttleDefault(RATE_LIMITS.sharedLinkRead))
  @ApiOperation({
    summary: 'Read what a private share link shares',
    description: 'An entry (its date, title, text and files; its mood and tags only if the writer chose), counting a view, or a book version’s description.',
  })
  @ApiParam(TOKEN_PARAM)
  @ApiResponse({ status: 200, description: 'The shared entry or book version', type: SharedContentResponseDto })
  @ApiResponse({ status: 404, description: NOT_AVAILABLE })
  async open(@Param('token') token: string): Promise<SharedContentResponseDto> {
    return this.sharedContentService.open(token);
  }

  @Get(':token/file')
  @Throttle(throttleDefault(RATE_LIMITS.sharedLinkRead))
  @ApiOperation({ summary: 'Download the book version a private share link shares, counting a view' })
  @ApiParam(TOKEN_PARAM)
  @ApiResponse({ status: 200, description: 'The exact file stored for this version, as a download' })
  @ApiResponse({ status: 404, description: NOT_AVAILABLE })
  async downloadBook(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const book = await this.sharedContentService.downloadBook(token);
    res.setHeader('Content-Type', book.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // An HTML book never runs in the page: it is a download, sandboxed if opened directly
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Disposition', contentDisposition(false, book.filename));
    res.send(book.content);
  }

  @Get(':token/attachments/:attachmentId')
  @Throttle(throttleDefault(RATE_LIMITS.sharedLinkFile))
  @ApiOperation({
    summary: 'Serve a file of the entry a private share link shares',
    description: 'Only that entry’s own attachments, by ID. A single `Range: bytes=` range is answered with 206.',
  })
  @ApiParam(TOKEN_PARAM)
  @ApiParam({ name: 'attachmentId', type: Number })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 206, description: 'The requested byte range of the file' })
  @ApiResponse({ status: 404, description: NOT_AVAILABLE })
  @ApiResponse({ status: 416, description: 'The requested range starts past the end of the file' })
  async attachment(
    @Param('token') token: string,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.sendFile(res, await this.sharedContentService.attachmentFile(token, attachmentId, 'file'), rangeHeader);
  }

  @Get(':token/attachments/:attachmentId/poster')
  @Throttle(throttleDefault(RATE_LIMITS.sharedLinkFile))
  @ApiOperation({ summary: 'Serve the poster frame of a video of the entry a private share link shares' })
  @ApiParam(TOKEN_PARAM)
  @ApiParam({ name: 'attachmentId', type: Number })
  @ApiResponse({ status: 200, description: 'The JPEG poster frame' })
  @ApiResponse({ status: 404, description: NOT_AVAILABLE })
  async poster(
    @Param('token') token: string,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Res() res: Response,
  ): Promise<void> {
    await this.sendFile(res, await this.sharedContentService.attachmentFile(token, attachmentId, 'poster'), undefined);
  }

  private sendFile(res: Response, file: Awaited<ReturnType<SharedContentService['attachmentFile']>>, rangeHeader: string | undefined) {
    return sendAttachmentFile(
      res,
      file,
      rangeHeader,
      (key, range) => this.attachmentsService.openFile(key, range),
      () => apiError(NotFoundException, 'SHARE_LINK_NOT_FOUND'),
    );
  }
}

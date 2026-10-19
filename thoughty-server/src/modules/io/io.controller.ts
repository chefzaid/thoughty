import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  Logger,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { IoService } from './io.service';
import { AppImportService } from './app-import.service';
import { MarkdownArchiveService } from './markdown-archive.service';
import { responseSink } from './response-sink';
import {
  FormatConfigDto,
  ExportQueryDto,
  PreviewImportDto,
  ImportDto,
  PreviewResponseDto,
  ImportResponseDto,
  AppImportDto,
  AppImportResponseDto,
  ImportAttachmentsDto,
  ImportAttachmentsResponseDto,
  MAX_IMPORT_FILES,
} from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { MULTIPART_FIELD_LIMITS } from '@/common/multipart-limits';
import { RATE_LIMITS, throttleDefault } from '@/common/rate-limit.constants';

@ApiTags('Import/Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('io')
export class IoController {
  private readonly logger = new Logger(IoController.name);

  constructor(
    private readonly ioService: IoService,
    private readonly appImportService: AppImportService,
    private readonly markdownArchiveService: MarkdownArchiveService,
  ) {}

  @Get('format')
  @ApiOperation({ summary: 'Get current file format settings' })
  @ApiResponse({ status: 200, description: 'Format settings' })
  async getFormat(@CurrentUser() user: AuthenticatedUser) {
    return this.ioService.getFormat(user.userId);
  }

  @Post('format')
  @ApiOperation({ summary: 'Save file format settings' })
  @ApiResponse({ status: 200, description: 'Settings saved' })
  async saveFormat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FormatConfigDto,
  ) {
    return this.ioService.saveFormat(user.userId, dto);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export entries as a file, or as a ZIP folder of Markdown files with attachments' })
  @ApiResponse({ status: 200, description: 'File content' })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    if (query.format === 'zip') {
      await this.sendMarkdownArchive(user.userId, res, query.diaryId);
      return;
    }

    const { content, filename, contentType } = await this.ioService.export(user.userId, query.diaryId, query.includeVisibility, query.format);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview import - parse file and check for duplicates' })
  @ApiResponse({ status: 200, description: 'Parsed entries with duplicate info', type: PreviewResponseDto })
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewImportDto,
  ): Promise<PreviewResponseDto> {
    return this.ioService.preview(user.userId, dto);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import entries from parsed content' })
  @ApiResponse({ status: 200, description: 'Import results', type: ImportResponseDto })
  async import(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportDto,
  ): Promise<ImportResponseDto> {
    return this.ioService.import(user.userId, dto);
  }

  @Post('import/entries')
  @HttpCode(200)
  @Throttle(throttleDefault(RATE_LIMITS.importWrite))
  @ApiOperation({ summary: 'Import a batch of entries from another journaling app (Day One, Journey)' })
  @ApiResponse({ status: 200, description: 'Entry ID for each source entry', type: AppImportResponseDto })
  async importAppEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AppImportDto,
  ): Promise<AppImportResponseDto> {
    return this.appImportService.importEntries(user.userId, dto);
  }

  @Post('import/attachments')
  @HttpCode(200)
  @Throttle(throttleDefault(RATE_LIMITS.importWrite))
  @ApiOperation({ summary: 'Attach photos and recordings from an app import to their entries' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['entryIds', 'files'],
      properties: {
        entryIds: { type: 'string', example: '12,12,13' },
        files: { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: MAX_IMPORT_FILES },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Stored attachments', type: ImportAttachmentsResponseDto })
  @UseInterceptors(
    FilesInterceptor('files', MAX_IMPORT_FILES, {
      storage: memoryStorage(),
      limits: {
        ...MULTIPART_FIELD_LIMITS,
        files: MAX_IMPORT_FILES,
        parts: MAX_IMPORT_FILES + 1,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async importAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: ImportAttachmentsDto,
  ): Promise<ImportAttachmentsResponseDto> {
    return this.appImportService.attachFiles(user.userId, files, dto.entryIds);
  }

  private async sendMarkdownArchive(userId: number, res: Response, diaryId?: number): Promise<void> {
    const archive = await this.markdownArchiveService.prepare(userId, diaryId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${archive.filename}"`);
    try {
      await archive.write(responseSink(res));
      res.end();
    } catch (error) {
      // Headers are already sent, so the only signal left is a cut connection
      this.logger.warn(`Markdown archive for user ${userId} stopped: ${(error as Error).message}`);
      res.destroy();
    }
  }
}

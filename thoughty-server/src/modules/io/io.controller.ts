import { Controller, Get, Post, Body, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { IoService } from './io.service';
import {
  FormatConfigDto,
  ExportQueryDto,
  PreviewImportDto,
  ImportDto,
  PreviewResponseDto,
  ImportResponseDto,
} from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';

@ApiTags('Import/Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('io')
export class IoController {
  constructor(private readonly ioService: IoService) {}

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
  @ApiOperation({ summary: 'Export entries as a text file' })
  @ApiResponse({ status: 200, description: 'Text file content' })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    const { content, filename } = await this.ioService.export(user.userId, query.diaryId);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
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
}

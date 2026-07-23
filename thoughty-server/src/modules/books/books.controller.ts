import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { BooksService } from './books.service';
import { BookQueryDto, BookPreviewResponseDto, BookUploadQueryDto } from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { CloudFileInfoDto, CloudSyncService } from '@/modules/cloud-sync';

@ApiTags('Books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly cloudSyncService: CloudSyncService,
  ) {}

  @Get('preview')
  @ApiOperation({ summary: 'Preview the book outline (chapters built from tags) before exporting' })
  @ApiResponse({ status: 200, description: 'Book outline with chapter titles and entry counts', type: BookPreviewResponseDto })
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookQueryDto,
  ): Promise<BookPreviewResponseDto> {
    return this.booksService.preview(user.userId, query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Convert journal entries into a book (chapters from tags) and download it' })
  @ApiResponse({ status: 200, description: 'Book file in the requested format (PDF, HTML, or Markdown)' })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookQueryDto,
    @Res() res: Response,
  ) {
    const { content, filename, contentType } = await this.booksService.export(user.userId, query);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Generate a book and upload it to a connected cloud provider' })
  @ApiResponse({ status: 201, description: 'Cloud file metadata for the uploaded book', type: CloudFileInfoDto })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookUploadQueryDto,
  ): Promise<CloudFileInfoDto> {
    const { provider, ...bookQuery } = query;
    const bookFile = await this.booksService.export(user.userId, bookQuery);
    return this.cloudSyncService.uploadFile(user.userId, provider, bookFile);
  }
}

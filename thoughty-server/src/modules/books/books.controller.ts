import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { BooksService } from './books.service';
import { BookQueryDto, BookPreviewResponseDto, BookUploadQueryDto } from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { CloudFileInfoDto, CloudSyncService } from '@/modules/cloud-sync';
import { MAX_BOOK_COVER_IMAGE_SIZE } from './book-cover.util';

const BOOK_COVER_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_BOOK_COVER_IMAGE_SIZE },
};

@ApiTags('Books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly cloudSyncService: CloudSyncService,
  ) {}

  private sendBookFile(
    res: Response,
    bookFile: Awaited<ReturnType<BooksService['export']>>,
  ): void {
    res.setHeader('Content-Type', bookFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${bookFile.filename}"`);
    res.send(bookFile.content);
  }

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
    const bookFile = await this.booksService.export(user.userId, query);
    this.sendBookFile(res, bookFile);
  }

  @Post('export')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate and download a book with an optional custom cover image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        coverImage: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Book file with the requested custom cover' })
  @UseInterceptors(
    FileInterceptor('coverImage', BOOK_COVER_UPLOAD_OPTIONS),
  )
  async exportWithCover(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookQueryDto,
    @UploadedFile() coverImage: Express.Multer.File | undefined,
    @Res() res: Response,
  ) {
    const bookFile = await this.booksService.export(user.userId, query, coverImage);
    this.sendBookFile(res, bookFile);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Generate a book and upload it to a connected cloud provider' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        coverImage: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Cloud file metadata for the uploaded book', type: CloudFileInfoDto })
  @UseInterceptors(
    FileInterceptor('coverImage', BOOK_COVER_UPLOAD_OPTIONS),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookUploadQueryDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ): Promise<CloudFileInfoDto> {
    const { provider, ...bookQuery } = query;
    const bookFile = await this.booksService.export(user.userId, bookQuery, coverImage);
    return this.cloudSyncService.uploadFile(user.userId, provider, bookFile);
  }
}

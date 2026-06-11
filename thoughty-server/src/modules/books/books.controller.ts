import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { BooksService } from './books.service';
import { BookQueryDto, BookPreviewResponseDto } from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';

@ApiTags('Books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

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
}

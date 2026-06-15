import { IsString, IsOptional, IsBoolean, IsNumber, IsIn, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class BookQueryDto {
  @ApiPropertyOptional({ description: 'Diary ID to build the book from' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Book output format', enum: ['pdf', 'epub', 'html', 'md'], default: 'pdf' })
  @IsOptional()
  @IsIn(['pdf', 'epub', 'html', 'md'])
  format?: 'pdf' | 'epub' | 'html' | 'md';

  @ApiPropertyOptional({ description: 'Book title (defaults to the diary name)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Author name shown on the title page (defaults to the username)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @ApiPropertyOptional({ description: 'Only include entries on or after this date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'dateFrom must be in YYYY-MM-DD format' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Only include entries on or before this date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'dateTo must be in YYYY-MM-DD format' })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Chapter ordering: alphabetical, by entry count, or by first entry date',
    enum: ['alpha', 'entries', 'chrono'],
    default: 'alpha',
  })
  @IsOptional()
  @IsIn(['alpha', 'entries', 'chrono'])
  chapterOrder?: 'alpha' | 'entries' | 'chrono';

  @ApiPropertyOptional({
    description: 'Chapter grouping mode: tags, calendar years, or calendar months',
    enum: ['tags', 'year', 'month'],
    default: 'tags',
  })
  @IsOptional()
  @IsIn(['tags', 'year', 'month'])
  chapterMode?: 'tags' | 'year' | 'month';

  @ApiPropertyOptional({
    description: 'Place entries in every matching tag chapter, or only in their first tag chapter',
    enum: ['all', 'first'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'first'])
  tagScope?: 'all' | 'first';

  @ApiPropertyOptional({ description: 'Comma-separated list of tags to use as chapters (defaults to all tags)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tags?: string;

  @ApiPropertyOptional({ description: 'Add a final chapter for entries without tags', default: true })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  includeUntagged?: boolean;

  @ApiPropertyOptional({ description: 'Show entry dates inside chapters', default: true })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  includeDates?: boolean;

  @ApiPropertyOptional({ description: 'Include a table of contents', default: true })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  includeToc?: boolean;

  @ApiPropertyOptional({
    description: 'Use AI to weave each chapter\'s entries into flowing prose (requires a configured AI key)',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  narrative?: boolean;

  @ApiPropertyOptional({
    description: 'AI weaving mode for narrative chapters',
    enum: ['strict', 'creative'],
    default: 'strict',
  })
  @IsOptional()
  @IsIn(['strict', 'creative'])
  weavingMode?: 'strict' | 'creative';
}

export class BookChapterPreviewDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  entryCount: number;

  @ApiProperty({ description: 'Date of the first entry in the chapter' })
  firstDate: string;

  @ApiProperty({ description: 'Date of the last entry in the chapter' })
  lastDate: string;
}

export class BookPreviewResponseDto {
  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  author?: string;

  @ApiProperty()
  chapterCount: number;

  @ApiProperty({ description: 'Total number of entry placements across chapters' })
  entryCount: number;

  @ApiProperty({ type: [BookChapterPreviewDto] })
  chapters: BookChapterPreviewDto[];
}

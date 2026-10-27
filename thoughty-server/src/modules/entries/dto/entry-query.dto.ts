// Query parameters for listing, finding and highlighting entries.
import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  IsNumber,
  Min,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/** The journal filters shared by the entry list and the calendar month: search, tags, flags, mood and diary. */
export class EntryFilterQueryDto {
  @ApiPropertyOptional({
    description:
      'Full-text search over content and tags, with English and French word forms and accents ignored. ' +
      'Supports "exact phrases" in quotes, a leading minus to exclude a word or phrase, and OR between ' +
      'alternatives; the last word also matches the longer words it starts.',
    example: '"morning run" -rain OR swim',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;

  @ApiPropertyOptional({ description: 'Comma-separated entry IDs to include, in relevance order' })
  @IsOptional()
  @IsString()
  @MaxLength(550)
  @Matches(/^\d+(,\d+)*$/)
  ids?: string;

  @ApiPropertyOptional({ description: 'Comma-separated list of tags to filter by' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ description: 'Filter by favorites only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  favorites?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by archive state',
    enum: ['all', 'active', 'archived'],
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(['all', 'active', 'archived'])
  archiveStatus?: 'all' | 'active' | 'archived';

  @ApiPropertyOptional({
    description:
      'Filter by recorded mood: one or more levels from 1 (very low) to 5 (very good), comma-separated; ' +
      '"any" for entries with a mood, or "none" for entries without one',
    example: '4,5',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @Matches(/^(any|none|[1-5](,[1-5]){0,4})$/, { message: 'Mood filter must be levels from 1 to 5, any, or none' })
  mood?: string;

  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  })
  @IsNumber()
  diaryId?: number;
}

export class GetEntriesQueryDto extends EntryFilterQueryDto {
  @ApiPropertyOptional({
    description: 'Order of search results: best match first, or by date as without a search',
    enum: ['relevance', 'date'],
    default: 'relevance',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(['relevance', 'date'])
  sort?: 'relevance' | 'date';

  @ApiPropertyOptional({ description: 'Filter by date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return 1;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 1 : parsed;
  })
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return 10;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 10 : parsed;
  })
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

export class GetFirstEntryQueryDto {
  @ApiPropertyOptional({ description: 'Year to find first entry' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ description: 'Month to find first entry' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  month?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  limit?: number = 10;
}

export class GetEntryByDateQueryDto {
  @ApiPropertyOptional({ description: 'Entry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Entry index for that day', default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  index?: number = 1;

  @ApiPropertyOptional({ description: 'Entry ID' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  id?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  limit?: number = 10;
}

export class GetHighlightsQueryDto {
  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  diaryId?: number;
}

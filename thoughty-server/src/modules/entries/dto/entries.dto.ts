import {
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  ArrayMaxSize,
  IsNumber,
  Min,
  IsInt,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateEntryDto {
  @ApiProperty({ description: 'Entry content' })
  @IsString()
  @MaxLength(50000, { message: 'Content exceeds maximum length of 50000 characters' })
  text: string;

  @ApiProperty({ description: 'Tags for the entry', type: [String] })
  @IsArray()
  @ArrayMaxSize(20, { message: 'Maximum 20 tags allowed' })
  @IsString({ each: true })
  @MaxLength(50, { each: true, message: 'Tag exceeds maximum length of 50 characters' })
  tags: string[];

  @ApiPropertyOptional({ description: 'Entry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'], default: 'private' })
  @IsOptional()
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  diaryId?: number;

  @ApiPropertyOptional({ enum: ['plain', 'markdown'], default: 'plain' })
  @IsOptional()
  @IsEnum(['plain', 'markdown'])
  format?: 'plain' | 'markdown';
}

export class UpdateEntryDto {
  @ApiProperty({ description: 'Entry content' })
  @IsString()
  @MaxLength(50000)
  text: string;

  @ApiProperty({ description: 'Tags for the entry', type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags: string[];

  @ApiProperty({ description: 'Entry date (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsOptional()
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ enum: ['plain', 'markdown'], default: 'plain' })
  @IsOptional()
  @IsEnum(['plain', 'markdown'])
  format?: 'plain' | 'markdown';
}

export class UpdateVisibilityDto {
  @ApiProperty({ enum: ['public', 'private'] })
  @IsEnum(['public', 'private'])
  visibility: 'public' | 'private';
}

export class BulkOperationDto {
  @ApiProperty({ description: 'Entry IDs to operate on', type: [Number] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one entry ID is required' })
  @IsInt({ each: true })
  @Type(() => Number)
  ids: number[];

  @ApiProperty({ description: 'Bulk action to perform', enum: ['delete', 'visibility', 'tags', 'move', 'archive'] })
  @IsEnum(['delete', 'visibility', 'tags', 'move', 'archive'])
  action: 'delete' | 'visibility' | 'tags' | 'move' | 'archive';

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsOptional()
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ description: 'Tags to set on entries', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Diary ID to move entries to' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Whether the entries should be archived' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isArchived?: boolean;
}

export class RenameTagDto {
  @ApiProperty({ description: 'Current tag name to rename' })
  @IsString()
  @MaxLength(50)
  oldTag: string;

  @ApiProperty({ description: 'New tag name that should replace the current tag' })
  @IsString()
  @MaxLength(50)
  newTag: string;
}

export class UpdateFavoriteDto {
  @ApiProperty({ description: 'Whether the entry is a favorite' })
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isFavorite: boolean;
}

export class UpdateArchivedDto {
  @ApiProperty({ description: 'Whether the entry is archived' })
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isArchived: boolean;
}

export class UpdatePinnedDto {
  @ApiProperty({ description: 'Whether the entry is pinned' })
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isPinned: boolean;
}

export class GetEntriesQueryDto {
  @ApiPropertyOptional({ description: 'Search term for content or tags' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Comma-separated list of tags to filter by' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Filter by date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ description: 'Filter by favorites only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  favorites?: boolean;

  @ApiPropertyOptional({ description: 'Filter by archive state', enum: ['all', 'active', 'archived'] })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(['all', 'active', 'archived'])
  archiveStatus?: 'all' | 'active' | 'archived';

  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  })
  @IsNumber()
  diaryId?: number;

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

export class ReorderEntriesDto {
  @ApiProperty({ description: 'Date of the entries to reorder (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Entry IDs in the desired order', type: [Number] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one entry ID is required' })
  @IsInt({ each: true })
  @Type(() => Number)
  orderedIds: number[];
}

export class DeleteAllQueryDto {
  @ApiPropertyOptional({ description: 'Diary ID to delete entries from' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  diaryId?: number;
}

export class EntryResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  user_id: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  diary_id: number | null;

  @ApiProperty()
  date: string;

  @ApiProperty()
  index: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: ['plain', 'markdown'] })
  format: 'plain' | 'markdown';

  @ApiProperty()
  visibility: 'public' | 'private';

  @ApiProperty()
  is_favorite: boolean;

  @ApiProperty()
  is_archived: boolean;

  @ApiProperty()
  is_pinned: boolean;

  @ApiPropertyOptional()
  diary_name?: string;

  @ApiPropertyOptional()
  diary_icon?: string;

  @ApiPropertyOptional()
  diary_color?: string;

  @ApiPropertyOptional({ type: () => [AttachmentResponseDto] })
  attachments?: AttachmentResponseDto[];

  @ApiProperty()
  created_at: Date;
}

export class EntriesListResponseDto {
  @ApiProperty({ type: [EntryResponseDto] })
  entries: EntryResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty({ type: [String] })
  allTags: string[];
}

export class EntryBacklinkDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  date: string;

  @ApiProperty()
  index: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: ['plain', 'markdown'] })
  format: 'plain' | 'markdown';

  @ApiProperty()
  visibility: 'public' | 'private';

  @ApiProperty()
  is_favorite: boolean;

  @ApiProperty()
  is_archived: boolean;

  @ApiProperty()
  is_pinned: boolean;

  @ApiPropertyOptional()
  diary_name?: string;

  @ApiPropertyOptional()
  diary_icon?: string;

  @ApiPropertyOptional()
  diary_color?: string;
}

export class EntryBacklinksResponseDto {
  @ApiProperty({ type: [EntryBacklinkDto] })
  backlinks: EntryBacklinkDto[];
}

export class AttachmentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  original_filename: string;

  @ApiProperty()
  stored_filename: string;

  @ApiProperty()
  mimetype: string;

  @ApiProperty()
  size: number;
}

export class EntryDatesResponseDto {
  @ApiProperty({ type: [String] })
  dates: string[];
}

export class FirstEntryResponseDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  found: boolean;

  @ApiPropertyOptional()
  entryId?: number;

  @ApiProperty({ type: [Number] })
  years: number[];

  @ApiProperty({ type: [String] })
  months: string[];
}

export class EntryLookupResponseDto {
  @ApiProperty()
  found: boolean;

  @ApiPropertyOptional({ type: EntryResponseDto })
  entry?: EntryResponseDto;

  @ApiPropertyOptional()
  page?: number;

  @ApiPropertyOptional()
  entryId?: number;

  @ApiPropertyOptional()
  error?: string;
}

export class CreateEntryResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  entryId: number;
}

export class EntryMutationResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: EntryResponseDto })
  entry: EntryResponseDto;
}

export class CountedMutationResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  affectedCount: number;
}

export class DeleteAllResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  deletedCount: number;
}

export class SuccessResponseDto {
  @ApiProperty()
  success: boolean;
}

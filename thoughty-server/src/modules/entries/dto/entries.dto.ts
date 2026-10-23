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
  Matches,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { MAX_ENTRY_TITLE_LENGTH, TIME_OF_DAY_PATTERN } from '@/common/utils/entry-order.util';
import { MAX_FEELING_LENGTH, MAX_FEELINGS, MAX_MOOD, MIN_MOOD } from '@/common/utils/entry-mood.util';

const TITLE_DESCRIPTION = 'Optional one-line title; empty or null removes it';
const TIME_OF_DAY_DESCRIPTION =
  'Optional time of day on a 24-hour clock (HH:MM); null removes it. Same-day entries without a time ' +
  'come first in their manual order, then those with one, earliest first. It never changes the ' +
  'same-day index that cross-references use.';
const MOOD_DESCRIPTION =
  'Optional mood check-in from 1 (very low) to 5 (very good); null removes it. It is private: the public ' +
  'feed never shows it.';
const FEELINGS_DESCRIPTION =
  'Optional feeling words with the mood: curated ones by their English name, or the writer\'s own words. ' +
  'Stored lowercase without duplicates; an empty list removes them.';

/** Title, time of day, and mood, shared by creating and editing; left out of an edit, they stay as they are. */
class EntryDetailsDto {
  @ApiPropertyOptional({ description: TITLE_DESCRIPTION, type: String, nullable: true, maxLength: MAX_ENTRY_TITLE_LENGTH, example: 'Morning walk by the river' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ENTRY_TITLE_LENGTH, { message: `Title exceeds maximum length of ${MAX_ENTRY_TITLE_LENGTH} characters` })
  @Matches(/^[^\r\n]*$/, { message: 'Title must be one line' })
  title?: string | null;

  @ApiPropertyOptional({ description: TIME_OF_DAY_DESCRIPTION, type: String, nullable: true, example: '08:30' })
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @Matches(TIME_OF_DAY_PATTERN, { message: 'Time of day must be HH:MM' })
  timeOfDay?: string | null;

  @ApiPropertyOptional({ description: MOOD_DESCRIPTION, type: Number, nullable: true, minimum: MIN_MOOD, maximum: MAX_MOOD, example: 4 })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'Mood must be a whole number from 1 to 5' })
  @Min(MIN_MOOD)
  @Max(MAX_MOOD)
  mood?: number | null;

  @ApiPropertyOptional({ description: FEELINGS_DESCRIPTION, type: [String], maxItems: MAX_FEELINGS, example: ['calm', 'grateful'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FEELINGS, { message: `Maximum ${MAX_FEELINGS} feelings allowed` })
  @IsString({ each: true })
  @MaxLength(MAX_FEELING_LENGTH, { each: true, message: `Feeling exceeds maximum length of ${MAX_FEELING_LENGTH} characters` })
  feelings?: string[];
}

export class CreateEntryDto extends EntryDetailsDto {
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

export class UpdateEntryDto extends EntryDetailsDto {
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

  @ApiProperty({
    description: 'Bulk action to perform',
    enum: ['delete', 'visibility', 'tags', 'move', 'archive'],
  })
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

export class DeleteTagQueryDto {
  @ApiProperty({ description: 'Tag to remove from all of the current user entries' })
  @IsString()
  @MaxLength(50)
  tag: string;
}

export class TagUsageDto {
  @ApiProperty()
  tag: string;

  @ApiProperty({ description: 'Number of entries using the tag' })
  count: number;
}

export class TagUsageListResponseDto {
  @ApiProperty({ type: [TagUsageDto] })
  tags: TagUsageDto[];
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

export class UpdateEntryTaskDto {
  @ApiProperty({
    description:
      'Line of the entry text holding the task list item (`- [ ]` or `- [x]`), counted from 0. Only Markdown ' +
      'entries have task lists.',
    minimum: 0,
    example: 2,
  })
  @IsInt({ message: 'Line must be a whole number' })
  @Min(0)
  line: number;

  @ApiProperty({ description: 'Whether the task is done', example: true })
  @IsBoolean()
  checked: boolean;
}

export class GetEntriesQueryDto {
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

  @ApiPropertyOptional({
    description: 'Order of search results: best match first, or by date as without a search',
    enum: ['relevance', 'date'],
    default: 'relevance',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(['relevance', 'date'])
  sort?: 'relevance' | 'date';

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

  @ApiProperty({
    description:
      'Entry IDs in the desired order: all of the day\'s entries, or some of them (such as those without a ' +
      'time), which then trade the same-day indexes they hold among themselves',
    type: [Number],
  })
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

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk by the river' })
  title: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Time of day (HH:MM), or null', example: '08:30' })
  time_of_day: string | null;

  @ApiProperty({ type: Number, nullable: true, minimum: MIN_MOOD, maximum: MAX_MOOD, description: 'Recorded mood from 1 (very low) to 5 (very good), or null', example: 4 })
  mood: number | null;

  @ApiProperty({ type: [String], description: 'Feeling words recorded with the mood', example: ['calm', 'grateful'] })
  feelings: string[];

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

  @ApiPropertyOptional({
    type: [String],
    description:
      'With a search: the words and phrases of this entry\'s title and text that match it, as written, ' +
      'longest first, for highlighting. Empty when only a tag matched.',
    example: ['morning run', 'swimming'],
  })
  search_matches?: string[];
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

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk by the river' })
  title: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Time of day (HH:MM), or null', example: '08:30' })
  time_of_day: string | null;

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

  @ApiPropertyOptional({ nullable: true })
  transcript?: string;

  @ApiPropertyOptional({ nullable: true })
  transcribed_at?: Date;
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

// Creating and editing one entry: its text and details, visibility, flags and task list items.
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
  IsBoolean,
  Matches,
  Max,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { SealEntryDto } from './entry-seal.dto';
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

  @ApiPropertyOptional({
    type: SealEntryDto,
    description:
      'Seals the entry as a time capsule until this local date and hour: its title, text, tags, mood and ' +
      'attachments stay hidden everywhere, it stays private and cannot be edited until it opens, then it is ' +
      'emailed to the writer and shown in Highlights.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SealEntryDto)
  seal?: SealEntryDto;
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

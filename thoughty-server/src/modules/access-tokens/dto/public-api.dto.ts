// The public API (`/api/v1`) that personal access tokens open: diaries, entries listed, and entries written.
import { ApiProperty, ApiPropertyOptional, OmitType, PickType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';
import { CreateEntryDto, EntryLocationResponseDto, GetEntriesQueryDto } from '@/modules/entries/dto';

/** Entries in one page of `GET /api/v1/entries`, at most. */
export const PUBLIC_ENTRY_LIST_MAX_LIMIT = 50;

/**
 * A new entry: the composer's fields, without visibility (an entry written through the API is always
 * private) or a time capsule seal, and with tags optional.
 */
export class PublicCreateEntryDto extends OmitType(CreateEntryDto, ['visibility', 'seal', 'tags'] as const) {
  @ApiPropertyOptional({ description: 'Tags for the entry; with automatic tagging on in the writer’s AI settings, more are added as in the composer', type: [String], example: ['walk'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Maximum 20 tags allowed' })
  @IsString({ each: true })
  @MaxLength(50, { each: true, message: 'Tag exceeds maximum length of 50 characters' })
  tags?: string[];
}

export class PublicEntriesQueryDto extends PickType(GetEntriesQueryDto, ['search', 'diaryId', 'after'] as const) {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: PUBLIC_ENTRY_LIST_MAX_LIMIT, description: 'Entries in the page' })
  @IsOptional()
  @StrictInt()
  @Min(1)
  @Max(PUBLIC_ENTRY_LIST_MAX_LIMIT)
  limit?: number;
}

export class PublicDiaryDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Travel' })
  name!: string;

  @ApiProperty({ example: '✈️' })
  icon!: string;

  @ApiProperty({ description: 'Where an entry written without a diary goes', example: false })
  isDefault!: boolean;

  @ApiProperty({ description: 'Locked behind the writer’s PIN: its entries are listed without their text', example: false })
  isLocked!: boolean;
}

export class PublicDiaryListResponseDto {
  @ApiProperty({ type: [PublicDiaryDto], description: 'In the writer’s order' })
  diaries!: PublicDiaryDto[];
}

export class PublicEntryDto {
  @ApiProperty({ example: 57 })
  id!: number;

  @ApiProperty({ type: Number, nullable: true, example: 2 })
  diaryId!: number | null;

  @ApiProperty({ example: '2026-11-21', description: 'The entry’s day (YYYY-MM-DD)' })
  date!: string;

  @ApiProperty({ example: 1, description: 'Its number among the day’s entries, as `[[2026-11-21#1]]` links to it' })
  index!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk' })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '08:30' })
  timeOfDay!: string | null;

  @ApiProperty({ description: 'Empty while the entry is withheld or sealed', example: 'Walked by the river.' })
  text!: string;

  @ApiProperty({ enum: ['plain', 'markdown'], example: 'plain' })
  format!: 'plain' | 'markdown';

  @ApiProperty({ type: [String], example: ['walk'] })
  tags!: string[];

  @ApiProperty({ type: Number, nullable: true, example: 4 })
  mood!: number | null;

  @ApiProperty({ type: [String], example: ['calm'] })
  feelings!: string[];

  @ApiProperty({ type: EntryLocationResponseDto, nullable: true, description: 'Where the entry was written, or null' })
  location!: EntryLocationResponseDto | null;

  @ApiProperty({ enum: ['public', 'private'], example: 'private' })
  visibility!: 'public' | 'private';

  @ApiProperty({
    description: 'Locked behind the writer’s PIN: the API never unlocks, so its text, tags, mood, feelings and place are left out',
    example: false,
  })
  withheld!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'While a sealed time capsule, when it opens', example: null })
  sealedUntil!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-21T08:31:00.000Z' })
  createdAt!: Date;
}

export class PublicEntryListResponseDto {
  @ApiProperty({ type: [PublicEntryDto], description: 'Newest first, as the journal lists them' })
  entries!: PublicEntryDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Pass as `after` for the next page; null on the last one', example: '1_2026-10-21__1_42' })
  nextCursor!: string | null;
}

export class PublicCreatedEntryResponseDto {
  @ApiProperty({ example: 58 })
  id!: number;

  @ApiProperty({ example: '2026-11-21', description: 'The day it was written for: the one sent, or the token’s time zone’s day' })
  date!: string;
}

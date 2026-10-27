import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { SavedSearchFilters } from '@/database/entities';
import { StrictBoolean } from '@/common/validation';

/** How many saved searches one writer can keep. */
export const SAVED_SEARCH_LIMIT = 50;
export const SAVED_SEARCH_NAME_MAX_LENGTH = 80;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** The journal filters, as `GET /api/entries` takes them, plus the search mode. */
export class SavedSearchFiltersDto implements SavedSearchFilters {
  @ApiProperty({ example: '"long walk" -rain', maxLength: 500, description: 'Search text; empty for none' })
  @IsString()
  @MaxLength(500)
  search!: string;

  @ApiProperty({ enum: ['keyword', 'semantic'], example: 'keyword' })
  @IsIn(['keyword', 'semantic'])
  searchMode!: 'keyword' | 'semantic';

  @ApiProperty({ enum: ['relevance', 'date'], example: 'relevance', description: 'Order of keyword search results' })
  @IsIn(['relevance', 'date'])
  sort!: 'relevance' | 'date';

  @ApiProperty({ type: [String], example: ['family'], maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  tags!: string[];

  @ApiProperty({ type: String, nullable: true, example: '2019-07-14', format: 'date', description: 'Entry date, or null for any date' })
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  date!: string | null;

  @ApiProperty({ enum: ['all', 'public', 'private'], example: 'all' })
  @IsIn(['all', 'public', 'private'])
  visibility!: 'all' | 'public' | 'private';

  @ApiProperty({ enum: ['active', 'archived', 'all'], example: 'active' })
  @IsIn(['active', 'archived', 'all'])
  archiveStatus!: 'active' | 'archived' | 'all';

  @ApiProperty({ example: true })
  @StrictBoolean()
  favorites!: boolean;

  @ApiProperty({
    example: '4,5',
    description: 'Mood levels from 1 to 5 (comma-separated), "any", "none", or empty for any mood',
  })
  @IsString()
  @Matches(/^(|any|none|[1-5](,[1-5]){0,4})$/, { message: 'Mood filter must be levels from 1 to 5, any, none, or empty' })
  mood!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    required: false,
    example: 3,
    description: 'Life era the entries are dated in; null or left out for any date (searches saved before eras have none)',
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsInt()
  @Min(1)
  eraId?: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    required: false,
    example: 12,
    description: 'Person the entries mention; null or left out for anyone (searches saved before people have none)',
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsInt()
  @Min(1)
  personId?: number | null;
}

export class CreateSavedSearchDto {
  @ApiProperty({ example: 'Family favorites', minLength: 1, maxLength: SAVED_SEARCH_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(SAVED_SEARCH_NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({ type: Number, nullable: true, example: 2, description: 'Diary the search is scoped to; null for all diaries' })
  @ValidateIf((_dto, value) => value !== null)
  @IsInt()
  @Min(1)
  diaryId!: number | null;

  @ApiProperty({ type: SavedSearchFiltersDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SavedSearchFiltersDto)
  filters!: SavedSearchFiltersDto;
}

export class RenameSavedSearchDto {
  @ApiProperty({ example: 'Family, 2019', minLength: 1, maxLength: SAVED_SEARCH_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(SAVED_SEARCH_NAME_MAX_LENGTH)
  name!: string;
}

export class SavedSearchResponseDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: 'Family favorites' })
  name!: string;

  @ApiProperty({ type: Number, nullable: true, example: 2, description: 'Null for all diaries' })
  diaryId!: number | null;

  @ApiProperty({ type: SavedSearchFiltersDto })
  filters!: SavedSearchFiltersDto;

  @ApiProperty({
    example: 2,
    minimum: 0,
    description: 'Book versions saved from this search, which are deleted with it',
  })
  bookVersionCount!: number;

  @ApiProperty({ example: '2026-10-27T09:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-27T09:30:00.000Z' })
  updatedAt!: Date;
}

export class SavedSearchListResponseDto {
  @ApiProperty({ type: [SavedSearchResponseDto], description: 'Sorted by name' })
  savedSearches!: SavedSearchResponseDto[];

  @ApiProperty({ example: SAVED_SEARCH_LIMIT, description: 'How many saved searches a writer can keep' })
  limit!: number;
}

export class SavedSearchDeleteResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/** How many entries one hand-picked book can hold. */
export const MAX_PICKED_BOOK_ENTRIES = 500;

export const BOOK_SOURCES = ['journal', 'savedSearch', 'entries'] as const;
export type BookSourceKind = (typeof BOOK_SOURCES)[number];

const ENTRY_IDS_PATTERN = /^\d+(,\d+)*$/;
const ENTRY_IDS_MAX_LENGTH = MAX_PICKED_BOOK_ENTRIES * 11;

const toNumber = ({ value }: { value: unknown }) =>
  value === '' || value === undefined || value === null ? undefined : Number(value);

/** Where a book's entries come from; the journal (a diary or all of them) unless told otherwise. */
export class BookSourceQueryDto {
  @ApiPropertyOptional({
    description:
      'Where the entries come from: the journal (the diary, date range and archive rules below), ' +
      'a saved search (its stored filters), or hand-picked entries',
    enum: BOOK_SOURCES,
    default: 'journal',
  })
  @IsOptional()
  @IsIn(BOOK_SOURCES)
  source?: BookSourceKind;

  @ApiPropertyOptional({ description: 'Saved search whose filters select the entries (source=savedSearch)', example: 4 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  savedSearchId?: number;

  @ApiPropertyOptional({
    description: `Comma-separated IDs of the hand-picked entries (source=entries), at most ${MAX_PICKED_BOOK_ENTRIES}`,
    example: '12,15,31',
  })
  @IsOptional()
  @IsString()
  @MaxLength(ENTRY_IDS_MAX_LENGTH)
  @Matches(ENTRY_IDS_PATTERN, { message: 'entryIds must be comma-separated entry IDs' })
  entryIds?: string;
}

export class BookPickedEntriesQueryDto {
  @ApiProperty({ description: `Comma-separated entry IDs, at most ${MAX_PICKED_BOOK_ENTRIES}`, example: '12,15,31' })
  @IsString()
  @MaxLength(ENTRY_IDS_MAX_LENGTH)
  @Matches(ENTRY_IDS_PATTERN, { message: 'entryIds must be comma-separated entry IDs' })
  entryIds!: string;
}

export class BookPickedEntryDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: '2024-05-01', format: 'date' })
  date!: string;

  @ApiProperty({ type: String, nullable: true, example: 'First day in Lisbon' })
  title!: string | null;

  @ApiProperty({ example: 'We walked down to the river and…', description: 'The first words of the entry, as plain text' })
  excerpt!: string;

  @ApiProperty({ type: Number, nullable: true, example: 2 })
  diaryId!: number | null;

  @ApiProperty({ type: String, nullable: true, example: 'Travel' })
  diaryName!: string | null;

  @ApiProperty({ example: false })
  isArchived!: boolean;
}

export class BookPickedEntriesResponseDto {
  @ApiProperty({ type: [BookPickedEntryDto], description: 'The picked entries the writer still has, by date' })
  entries!: BookPickedEntryDto[];

  @ApiProperty({
    type: [Number],
    example: [44],
    description: 'Picked IDs that are not the writer’s entries or are in the recycle bin',
  })
  missingIds!: number[];
}

export class BookVersionSourceDto {
  @ApiProperty({ enum: BOOK_SOURCES })
  kind!: BookSourceKind;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'The diary of a journal book; null for all diaries' })
  diaryId?: number | null;

  @ApiPropertyOptional({ description: 'The saved search of a saved-search book', example: 4 })
  savedSearchId?: number;

  @ApiPropertyOptional({ description: 'The saved search’s name when the version was made', example: 'Family favorites' })
  savedSearchName?: string;

  @ApiPropertyOptional({ type: [Number], description: 'The hand-picked entries of the version', example: [12, 15] })
  entryIds?: number[];
}

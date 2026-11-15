// Query parameters for listing, finding and highlighting entries.
import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  Max,
  Min,
  Matches,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { StrictBoolean, StrictInt, WritersDay } from '@/common/validation';
import { ENTRY_LIST_CURSOR_PATTERN } from '../entry-list-cursor';

/** Entries in one batch of the journal list, at most. */
export const ENTRY_LIST_MAX_LIMIT = 100;

const LIST_POSITIONS = ['after', 'from', 'before', 'around'] as const;

/** A batch starts from one place at most: after a cursor, before one, or around an entry. */
function OnlyOneListPosition(): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'onlyOneListPosition',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: 'after, from, before and around cannot be combined' },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const query = args.object as Partial<Record<(typeof LIST_POSITIONS)[number], unknown>>;
          return value === undefined
            || LIST_POSITIONS.every((other) => other === propertyName || query[other] === undefined);
        },
      },
    });
  };
}

/** The journal filters shared by the entry list and the calendar month: search, tags, flags, mood, diary, life era and person. */
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
  @StrictBoolean()
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
  @StrictInt()
  diaryId?: number;

  @ApiPropertyOptional({
    description: 'Life era ID: only entries dated within the era (from its start to its end, with no end while it is ongoing)',
    example: 3,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  eraId?: number;

  @ApiPropertyOptional({ description: 'Person ID: only entries that mention the person', example: 12 })
  @IsOptional()
  @StrictInt()
  @Min(1)
  personId?: number;
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

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: ENTRY_LIST_MAX_LIMIT, description: 'Entries in the batch' })
  @IsOptional()
  @StrictInt()
  @Min(1)
  @Max(ENTRY_LIST_MAX_LIMIT)
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'The `nextCursor` of the batch before: this batch starts right after its last entry, even when entries were '
      + 'written or deleted meanwhile. Only one of `after`, `from`, `before` and `around`',
    example: '1_2026-10-21__1_42',
  })
  @IsOptional()
  @Matches(ENTRY_LIST_CURSOR_PATTERN, { message: 'after must be the nextCursor of a batch of entries' })
  @OnlyOneListPosition()
  after?: string;

  @ApiPropertyOptional({
    description:
      'The `prevCursor` of a batch: the batch starts at its first entry, included, to read that batch again '
      + '(one opened `around` an entry, say) with the entries it holds now',
    example: '1_2026-10-25_08:30_2_57',
  })
  @IsOptional()
  @Matches(ENTRY_LIST_CURSOR_PATTERN, { message: 'from must be the prevCursor of a batch of entries' })
  @OnlyOneListPosition()
  from?: string;

  @ApiPropertyOptional({
    description:
      'The `prevCursor` of the batch after: this batch holds the entries right before its first entry, in list order',
    example: '1_2026-10-25_08:30_2_57',
  })
  @IsOptional()
  @Matches(ENTRY_LIST_CURSOR_PATTERN, { message: 'before must be the prevCursor of a batch of entries' })
  @OnlyOneListPosition()
  before?: string;

  @ApiPropertyOptional({
    description:
      'An entry ID: the batch holds that entry with the entries listed just before and after it (half the batch '
      + 'each way, more of one when the other ends sooner), to open the list at an entry. 404 `ENTRY_NOT_FOUND` '
      + 'when the filters leave it out',
    example: 42,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  @OnlyOneListPosition()
  around?: number;
}

/** A year or month to open the journal at, among the journal filters. */
export class GetFirstEntryQueryDto extends EntryFilterQueryDto {
  @ApiPropertyOptional({ description: 'Year to find first entry' })
  @IsOptional()
  @StrictInt()
  year?: number;

  @ApiPropertyOptional({ description: 'Month to find first entry' })
  @IsOptional()
  @StrictInt()
  month?: number;
}

export class GetEntryByDateQueryDto {
  @ApiPropertyOptional({ description: 'Entry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Entry index for that day', default: 1 })
  @IsOptional()
  @StrictInt()
  index?: number = 1;

  @ApiPropertyOptional({ description: 'Entry ID' })
  @IsOptional()
  @StrictInt()
  id?: number;
}

export class GetHighlightsQueryDto {
  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @StrictInt()
  diaryId?: number;

  @ApiPropertyOptional({
    example: '2026-10-31',
    format: 'date',
    description: 'The writer’s own day (the UTC day or the one before or after it), which On This Day, `currentDate` and reread reminders are measured by; the server’s UTC day when left out',
  })
  @IsOptional()
  @WritersDay()
  today?: string;
}

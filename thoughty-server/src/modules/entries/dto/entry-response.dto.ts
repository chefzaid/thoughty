// Response bodies of the entries API.
import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { MAX_MOOD, MIN_MOOD } from '@/common/utils/entry-mood.util';

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

export class EntryHighlightsDateDto {
  @ApiProperty({ example: '01' })
  month: string;

  @ApiProperty({ example: '15' })
  day: string;

  @ApiProperty({ example: 2026 })
  year: number;
}

export class EntryHighlightsResponseDto {
  @ApiProperty({ type: EntryResponseDto, nullable: true, description: 'A random entry, or null when there is none' })
  randomEntry: EntryResponseDto | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { $ref: getSchemaPath(EntryResponseDto) } },
    description: 'Entries written on this day in earlier years, keyed by how many years ago',
    example: { 1: [] },
  })
  onThisDay: Record<number, EntryResponseDto[]>;

  @ApiProperty({ type: EntryHighlightsDateDto })
  currentDate: EntryHighlightsDateDto;
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

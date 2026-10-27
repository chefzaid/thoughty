// The calendar month: the query and the short summaries of the month's entries.
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { MAX_MOOD, MIN_MOOD } from '@/common/utils/entry-mood.util';
import { EntryFilterQueryDto } from './entry-query.dto';

export class GetEntryCalendarQueryDto extends EntryFilterQueryDto {
  @ApiProperty({ description: 'The month to show (YYYY-MM)', example: '2026-10', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Month must be YYYY-MM' })
  month: string;
}

export class EntryCalendarItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ type: Number, nullable: true })
  diary_id: number | null;

  @ApiProperty({ description: 'Entry date (YYYY-MM-DD)', example: '2026-10-21' })
  date: string;

  @ApiProperty({ description: 'Same-day index, as cross-references use it', example: 1 })
  index: number;

  @ApiProperty({ type: String, nullable: true, description: 'Time of day (HH:MM), or null', example: '08:30' })
  time_of_day: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk by the river' })
  title: string | null;

  @ApiProperty({ description: 'The start of the text as plain words, cut at a word boundary', example: 'A slow walk along the river before work…' })
  snippet: string;

  @ApiProperty({ type: Number, nullable: true, minimum: MIN_MOOD, maximum: MAX_MOOD, description: 'Recorded mood from 1 (very low) to 5 (very good), or null', example: 4 })
  mood: number | null;
}

export class EntryCalendarResponseDto {
  @ApiProperty({ example: '2026-10' })
  month: string;

  @ApiProperty({
    type: [EntryCalendarItemDto],
    description: "The month's entries that match the filters, by day and then in each day's order",
  })
  entries: EntryCalendarItemDto[];
}

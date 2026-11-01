// The reader: one entry of the journal filters at a time, oldest first, with its neighbours.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';
import { EntryFilterQueryDto } from './entry-query.dto';
import { EntryResponseDto } from './entry-response.dto';

/** The journal filters, optionally narrowed to a day or a month, and the entry to show. */
export class GetEntryReaderQueryDto extends EntryFilterQueryDto {
  @ApiPropertyOptional({ description: "Only this day's entries (YYYY-MM-DD), as the list's date filter", example: '2026-10-21' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({
    description: "Only this month's entries (YYYY-MM), as the calendar shows them",
    example: '2026-10',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Month must be YYYY-MM' })
  month?: string;

  @ApiPropertyOptional({ description: 'The entry to show; without it, the oldest one that matches', example: 42 })
  @IsOptional()
  @StrictInt()
  @Min(1)
  entryId?: number;
}

export class EntryReaderResponseDto {
  @ApiProperty({ type: EntryResponseDto, description: 'The entry, whole, with its diary and attachments' })
  entry: EntryResponseDto;

  @ApiProperty({ type: Number, nullable: true, description: 'The entry before it (older), or null for the first', example: 41 })
  previousId: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'The entry after it (newer), or null for the last', example: 43 })
  nextId: number | null;

  @ApiProperty({ description: 'Its place among the entries read, from 1 for the oldest', example: 3 })
  position: number;

  @ApiProperty({ description: 'How many entries are read', example: 12 })
  total: number;
}

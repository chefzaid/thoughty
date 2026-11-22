// A conversation with the AI about the entries the journal filters match, a date range of them at most.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { ChatMessageDto } from '@/modules/ai';
import { EntryFilterQueryDto } from './entry-query.dto';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The journal filters (as the list and the reader take them), the list's day, and a date range. */
export class EntryChatQueryDto extends EntryFilterQueryDto {
  @ApiPropertyOptional({ description: "Only this day's entries (YYYY-MM-DD), as the list's date filter", example: '2026-10-21' })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ description: 'Only entries dated on or after this day (YYYY-MM-DD)', example: '2026-01-01' })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Only entries dated on or before this day (YYYY-MM-DD)', example: '2026-06-30' })
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;
}

export class EntryChatDto {
  @ApiProperty({
    description: 'The conversation so far, oldest first, ending with the message to answer',
    type: [ChatMessageDto],
    minItems: 1,
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

/** An entry the conversation reads, under the number the replies cite it by. */
export class EntryChatEntryDto {
  @ApiProperty({ description: 'Its number in the conversation, from 1 for the oldest entry read', example: 1 })
  ref!: number;

  @ApiProperty({ description: 'The entry ID', example: 42 })
  id!: number;

  @ApiProperty({ description: 'The entry date (YYYY-MM-DD)', example: '2026-03-14' })
  date!: string;

  @ApiProperty({ type: String, nullable: true, description: 'The entry title, if it has one', example: 'A walk by the sea' })
  title!: string | null;
}

export class EntryChatResponseDto {
  @ApiProperty({ description: 'The reply, citing entries by their number in square brackets ([2])' })
  reply!: string;

  @ApiProperty({
    type: [EntryChatEntryDto],
    description: 'The entries read for this reply, oldest first: the newest that match, at most 50',
  })
  entries!: EntryChatEntryDto[];

  @ApiProperty({ type: [Number], description: 'The numbers (`ref`) of the entries the reply cites, in the order first cited', example: [2, 1] })
  cited!: number[];

  @ApiProperty({ description: 'How many entries match, read or not', example: 120 })
  total!: number;
}

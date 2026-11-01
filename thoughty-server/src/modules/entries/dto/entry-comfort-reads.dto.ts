// Comfort reads: a few of the writer's favorite or gratitude entries, offered after a very low mood.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';

/** The entry just written, which is never offered back. */
export class GetComfortReadsQueryDto {
  @ApiPropertyOptional({ description: 'The entry just written, left out of the picks', example: 42 })
  @IsOptional()
  @StrictInt()
  @Min(1)
  excludeId?: number;
}

export class ComfortReadDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ description: 'Entry date (YYYY-MM-DD)', example: '2025-06-14' })
  date: string;

  @ApiProperty({ description: 'Same-day index, as cross-references use it', example: 1 })
  index: number;

  @ApiProperty({ type: String, nullable: true, description: 'Its title, if it has one', example: 'The lake at dawn' })
  title: string | null;

  @ApiProperty({ description: 'The start of its text as plain words, cut at a word', example: 'We swam before anyone else was up…' })
  excerpt: string;
}

export class ComfortReadsResponseDto {
  @ApiProperty({
    type: [ComfortReadDto],
    description: 'Up to three entries, in a random order; empty when the writer has none to offer',
  })
  entries: ComfortReadDto[];
}

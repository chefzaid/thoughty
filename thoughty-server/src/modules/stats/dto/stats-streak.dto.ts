import { ApiProperty } from '@nestjs/swagger';

/** The latest entry on or before the writer's day, as a short summary to pick up from. */
export class WritingStreakLastEntryDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: '2026-10-21', format: 'date', description: 'Entry date (YYYY-MM-DD)' })
  date!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk by the river' })
  title!: string | null;

  @ApiProperty({
    example: 'A slow walk along the river before work…',
    description: 'The start of the text as plain words, cut at a word boundary',
  })
  snippet!: string;
}

/** `GET /api/stats/streak`: the writing streak and the last entry, measured up to the writer's day. */
export class WritingStreakResponseDto {
  @ApiProperty({
    example: 4,
    minimum: 0,
    description: 'Days in a row with at least one entry, up to today; a today without an entry yet does not break it',
  })
  currentStreak!: number;

  @ApiProperty({ example: true, description: 'Whether there is an entry dated today' })
  writtenToday!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    example: 0,
    description: 'Days from the last entry to today; null when there is no entry yet',
  })
  daysSinceLastEntry!: number | null;

  @ApiProperty({
    type: WritingStreakLastEntryDto,
    nullable: true,
    description: 'The latest entry on or before today; null when there is no entry yet',
  })
  lastEntry!: WritingStreakLastEntryDto | null;
}

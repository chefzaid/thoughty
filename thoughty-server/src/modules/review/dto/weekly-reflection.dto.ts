import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Min } from 'class-validator';
import { StrictInt, WritersDay } from '@/common/validation';

/** The seven days ending on the writer's day, all diaries or one. */
export class WeeklyReflectionQueryDto {
  @ApiProperty({
    example: '2026-11-21',
    format: 'date',
    description: 'The writer’s own day (the UTC day or the one before or after it); the week is that day and the six before it',
  })
  @WritersDay()
  today: string;

  @ApiPropertyOptional({ description: 'Reflect on one diary instead of all of them' })
  @IsOptional()
  @StrictInt()
  @Min(1)
  diaryId?: number;
}

export class WeeklyReflectionRequestDto extends WeeklyReflectionQueryDto {}

export class WeeklyReflectionDto {
  @ApiProperty({ example: '2026-11-15', format: 'date', description: 'The first of the seven days read' })
  weekStart: string;

  @ApiProperty({ example: '2026-11-21', format: 'date', description: 'The writer’s day the reflection was asked on, the last of the seven' })
  weekEnd: string;

  @ApiProperty({ type: [String], example: ['garden', 'tired evenings'], description: 'One to four themes that came back, the most present first' })
  themes: string[];

  @ApiProperty({ example: 'You found calm in the garden despite long days at work.' })
  summary: string;

  @ApiProperty({ example: 'What would make one evening this week feel like your own?', description: 'One question for the week ahead' })
  question: string;

  @ApiProperty({ example: 5, description: 'How many entries were read' })
  analyzedEntries: number;

  @ApiProperty({ format: 'date-time' })
  generatedAt: string;
}

export class WeeklyReflectionStateDto {
  @ApiProperty({ example: '2026-11-15', format: 'date', description: 'The first of the seven days ending on `today`' })
  weekStart: string;

  @ApiProperty({ example: '2026-11-21', format: 'date' })
  weekEnd: string;

  @ApiProperty({
    example: 5,
    description:
      'The entries of those seven days a reflection can read (with words, not archived, not locked, outside the recycle bin); ' +
      'it reads up to 21 of them, spread across the week',
  })
  entries: number;

  @ApiProperty({
    type: WeeklyReflectionDto,
    nullable: true,
    description: 'The saved reflection for this scope, when it was asked on one of these seven days; null otherwise',
  })
  reflection: WeeklyReflectionDto | null;

  @ApiProperty({ description: 'Whether the week can be read with AI' })
  aiAvailable: boolean;
}

export class WeeklyReflectionResponseDto {
  @ApiProperty({ type: WeeklyReflectionDto })
  reflection: WeeklyReflectionDto;
}

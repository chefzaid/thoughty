import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Matches, Min } from 'class-validator';
import type { DiaryGoalType } from '@/database/entities';
import { DIARY_GOAL_TYPES } from '@/modules/diaries/dto';

export class StatsQueryDto {
  @ApiPropertyOptional({ example: 3, minimum: 1, description: 'Limit the statistics to one diary' })
  @IsOptional()
  @IsInt()
  @Min(1)
  diaryId?: number;

  @ApiPropertyOptional({
    example: '2026-10-27',
    format: 'date',
    description: 'The writer’s own day, which writing goals are measured up to; the server’s UTC day when left out',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  today?: string;
}

export class DiaryGoalProgressDto {
  @ApiProperty({ example: 3 })
  diaryId!: number;

  @ApiProperty({ example: 'Morning pages' })
  diaryName!: string;

  @ApiProperty({ example: '📓' })
  diaryIcon!: string;

  @ApiProperty({ enum: DIARY_GOAL_TYPES, example: 'entries_per_week' })
  goalType!: DiaryGoalType;

  @ApiProperty({ example: 3, description: 'Entries a week or words a day' })
  goalTarget!: number;

  @ApiProperty({ enum: ['day', 'week'], example: 'week', description: 'Weeks run from Monday to Sunday' })
  period!: 'day' | 'week';

  @ApiProperty({ example: '2026-10-26', format: 'date', description: 'Today, or the Monday of this week' })
  periodStart!: string;

  @ApiProperty({ example: 2, description: 'Words written today, or entries written this week' })
  progress!: number;

  @ApiProperty({ example: false })
  met!: boolean;

  @ApiProperty({
    example: 4,
    description: 'Periods in a row that met the goal; the current one counts once met and does not break the streak before',
  })
  currentStreak!: number;

  @ApiProperty({ example: 6 })
  longestStreak!: number;

  @ApiProperty({
    type: [String],
    example: ['2026-10-05', '2026-10-12', '2026-10-19'],
    description: 'First day of every period that met the goal, oldest first',
  })
  metPeriods!: string[];
}

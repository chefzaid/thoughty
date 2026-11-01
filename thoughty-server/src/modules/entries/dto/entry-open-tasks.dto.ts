// The open tasks across the journal: the unticked task list items of Markdown entries.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches, Max, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';
import { OPEN_TASK_CURSOR_PATTERN } from '../entry-open-tasks.cursor';

/** Open tasks on one page, at most. */
export const OPEN_TASKS_MAX_LIMIT = 100;

export class GetOpenTasksQueryDto {
  @ApiPropertyOptional({ description: 'Only the tasks of this diary; all diaries when left out' })
  @IsOptional()
  @StrictInt()
  @Min(1)
  diaryId?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @StrictInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: OPEN_TASKS_MAX_LIMIT })
  @IsOptional()
  @StrictInt()
  @Min(1)
  @Max(OPEN_TASKS_MAX_LIMIT)
  limit?: number = 50;

  @ApiPropertyOptional({
    description:
      'The `nextCursor` of the page before: this page then starts right after its last task, even when tasks on it '
      + 'were ticked meanwhile, and `page` is left out',
    example: '2026-10-21__1_42_3',
  })
  @IsOptional()
  @Matches(OPEN_TASK_CURSOR_PATTERN, { message: 'after must be the nextCursor of a page of open tasks' })
  after?: string;
}

export class OpenTaskDto {
  @ApiProperty({ description: 'The entry holding the task', example: 42 })
  entryId: number;

  @ApiProperty({ description: 'Entry date (YYYY-MM-DD)', example: '2026-10-21' })
  date: string;

  @ApiProperty({ type: String, nullable: true, example: 'Errands' })
  title: string | null;

  @ApiProperty({
    description: 'Line of the entry text holding the task, counted from 0: send it, with `text`, to tick the task',
    example: 2,
  })
  line: number;

  @ApiProperty({ description: 'What follows the box on that line, as written (Markdown)', example: 'Call the bank' })
  text: string;
}

export class OpenTasksResponseDto {
  @ApiProperty({
    type: [OpenTaskDto],
    description: 'The page of unticked tasks: newest entries first, and in each entry from top to bottom',
  })
  tasks: OpenTaskDto[];

  @ApiProperty({ description: 'Unticked tasks in all, across the pages', example: 3 })
  total: number;

  @ApiProperty({ description: 'This page, counted from the tasks before it when read with `after`', example: 1 })
  page: number;

  @ApiProperty({ example: 1 })
  totalPages: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Send it as `after` to read the next page; null when no task follows this page',
    example: '2026-10-21__1_42_3',
  })
  nextCursor: string | null;
}

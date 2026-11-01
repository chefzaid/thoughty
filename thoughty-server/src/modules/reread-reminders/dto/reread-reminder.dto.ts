import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `PUT /api/entries/:id/reread-reminder`: the day to reread the entry on, and the writer's own day. */
export class SetRereadReminderDto {
  @ApiProperty({
    example: '2026-11-07',
    format: 'date',
    description: 'The writer’s day to reread the entry on (YYYY-MM-DD), from tomorrow up to 50 years after `today`',
  })
  @Matches(LOCAL_DAY)
  @IsDateString({ strict: true })
  rereadOn!: string;

  @ApiProperty({
    example: '2026-10-31',
    format: 'date',
    description: 'The writer’s own day (YYYY-MM-DD), which must be the UTC day or the one before or after it',
  })
  @Matches(LOCAL_DAY)
  @IsDateString({ strict: true })
  today!: string;
}

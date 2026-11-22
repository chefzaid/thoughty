import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { WritersDay } from '@/common/validation';
import { PERSON_GROUP_NAME_MAX_LENGTH } from '../person-groups';
import { PERSON_MENTION_MONTHS } from '../person-mentions';

const TODAY_DESCRIPTION =
  'The writer’s own day (the UTC day or the one before or after it): the months end with its month and the years with its ' +
  'year, and entries dated after it are left out; the server’s UTC day when left out';

/** `GET /api/people/:id/mentions-over-time`: the writer's day the periods end on. */
export class PersonMentionsQueryDto {
  @ApiPropertyOptional({ example: '2026-11-22', format: 'date', description: TODAY_DESCRIPTION })
  @IsOptional()
  @WritersDay()
  today?: string;
}

/** `GET /api/people/mentions-over-time`: the group, and the writer's day the periods end on. */
export class GroupMentionsQueryDto extends PersonMentionsQueryDto {
  @ApiProperty({
    example: 'Friends',
    minLength: 1,
    maxLength: PERSON_GROUP_NAME_MAX_LENGTH,
    description: 'One of the writer’s groups, ignoring case and the spaces around it; a group no one is in has no mentions',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(PERSON_GROUP_NAME_MAX_LENGTH)
  group!: string;
}

/** The entries of one month or year that mention the person or someone in the group, and their mood. */
export class MentionPeriodDto {
  @ApiProperty({ example: '2026-03', description: 'The month (YYYY-MM) or the year (YYYY)' })
  period!: string;

  @ApiProperty({ example: 3, minimum: 0, description: 'Entries of the period that mention them, each counted once' })
  entries!: number;

  @ApiProperty({ example: 2, minimum: 0, description: 'How many of those entries have a mood check-in' })
  moodEntries!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.5,
    minimum: 1,
    maximum: 5,
    description: 'The average mood of those entries, to one decimal (1 very low to 5 very good); null when none has a mood',
  })
  averageMood!: number | null;
}

export class MentionsOverTimeResponseDto {
  @ApiProperty({
    example: 14,
    minimum: 0,
    description:
      'Entries up to the writer’s day that mention them, leaving out the recycle bin, sealed time capsules and (unless ' +
      'unlocked) locked entries',
  })
  entries!: number;

  @ApiProperty({
    type: () => [MentionPeriodDto],
    description: `The last ${PERSON_MENTION_MONTHS} months, oldest first, ending with the writer’s month; months without a mention count 0`,
  })
  months!: MentionPeriodDto[];

  @ApiProperty({
    type: () => [MentionPeriodDto],
    description:
      'Every year from the first one with a mention to the writer’s year, oldest first, years without a mention counting 0; ' +
      'empty when nothing mentions them',
  })
  years!: MentionPeriodDto[];
}

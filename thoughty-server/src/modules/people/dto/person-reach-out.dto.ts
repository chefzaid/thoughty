import { ApiProperty } from '@nestjs/swagger';
import { WritersDay } from '@/common/validation';
import { REACH_OUT_DAYS } from '../person-reach-out';

/** `POST /api/people/:id/contacted`: the writer's own day, recorded as the last contact. */
export class MarkPersonContactedDto {
  @ApiProperty({
    example: '2026-11-22',
    format: 'date',
    description: 'The writer’s own day (YYYY-MM-DD), the UTC day or the one before or after it; it becomes the last contact',
  })
  @WritersDay()
  today!: string;
}

/** A person Highlights reminds the writer to reach out to. */
export class PersonReachOutHighlightDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'Marie' })
  name: string;

  @ApiProperty({ enum: REACH_OUT_DAYS, example: 30, description: 'The reminder the writer chose: at most this many days without being in touch' })
  reachOutDays: number;

  @ApiProperty({ type: String, nullable: true, format: 'date', example: '2026-09-02', description: 'The last contact the writer recorded; null when none is' })
  lastContactOn: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date',
    example: '2026-10-01',
    description: 'The newest entry that mentions the person, leaving out the recycle bin and sealed time capsules; null when none does',
  })
  lastMentionedOn: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 52,
    description: 'Days from the later of the last contact and the newest mention to the writer’s day; null when there is neither',
  })
  daysSince: number | null;
}

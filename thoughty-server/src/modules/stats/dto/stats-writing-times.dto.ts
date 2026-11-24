import { ApiProperty } from '@nestjs/swagger';

/**
 * When the writer writes: entries by hour of the day and by weekday, in the writer's time zone. An
 * entry with a time of day counts at that time on the weekday of its date; one without counts when it
 * was created, unless it was imported (its creation time is then the import's), which `untimedImports`
 * counts instead.
 */
export class StatsWritingTimesDto {
  @ApiProperty({
    type: [Number],
    minItems: 24,
    maxItems: 24,
    example: [0, 0, 0, 0, 0, 0, 1, 3, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 2, 4, 6, 3, 1],
    description: 'Entries in each hour of the day, from 00:00 to 23:00',
  })
  hours!: number[];

  @ApiProperty({
    type: [Number],
    minItems: 7,
    maxItems: 7,
    example: [4, 3, 5, 2, 3, 6, 2],
    description: 'Entries on each weekday, Monday first',
  })
  weekdays!: number[];

  @ApiProperty({
    example: 12,
    minimum: 0,
    description: 'Imported entries without a time of day, left out of `hours` and `weekdays`: their creation time is the moment of the import, not when they were written',
  })
  untimedImports!: number;
}

import { ApiProperty } from '@nestjs/swagger';

/** The entry a record links to, by ID and by its day and number on that day (`[[2024-03-02#2]]`). */
export class StatsRecordEntryDto {
  @ApiProperty({ example: 42 })
  entryId!: number;

  @ApiProperty({ example: '2024-03-02', format: 'date' })
  date!: string;

  @ApiProperty({ example: 2, description: 'The entry’s number on its day, as cross-references write it' })
  index!: number;
}

export class StatsLongestEntryDto extends StatsRecordEntryDto {
  @ApiProperty({ example: 1240, minimum: 1 })
  words!: number;
}

/** An entry at the earliest or latest time of day the writer wrote, in their time zone. */
export class StatsTimeRecordDto extends StatsRecordEntryDto {
  @ApiProperty({ example: '05:12', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'Local time of day, `HH:MM`' })
  time!: string;
}

export class StatsBusiestDayDto {
  @ApiProperty({ example: '2025-06-14', format: 'date' })
  date!: string;

  @ApiProperty({ example: 5, minimum: 1 })
  entries!: number;
}

export class StatsLongestStreakDto {
  @ApiProperty({ example: 12, minimum: 1, description: 'Days in a row with at least one entry' })
  days!: number;

  @ApiProperty({ example: '2025-03-01', format: 'date', description: 'The first day of the run' })
  startDate!: string;

  @ApiProperty({ example: '2025-03-12', format: 'date', description: 'The last day of the run' })
  endDate!: string;
}

/**
 * The writer's personal records, in one diary or all of them; each is null until there is an entry to
 * hold it. Ties go to the earliest.
 */
export class StatsRecordsDto {
  @ApiProperty({ type: StatsLongestEntryDto, nullable: true, description: 'The entry with the most words' })
  longestEntry!: StatsLongestEntryDto | null;

  @ApiProperty({ type: StatsBusiestDayDto, nullable: true, description: 'The day with the most entries' })
  busiestDay!: StatsBusiestDayDto | null;

  @ApiProperty({ type: StatsLongestStreakDto, nullable: true, description: 'The most days in a row with an entry' })
  longestStreak!: StatsLongestStreakDto | null;

  @ApiProperty({
    type: StatsTimeRecordDto,
    nullable: true,
    description: 'The entry written earliest in the day: its typed time, or its creation time in the writer’s time zone',
  })
  earliestEntry!: StatsTimeRecordDto | null;

  @ApiProperty({ type: StatsTimeRecordDto, nullable: true, description: 'The entry written latest in the day, read the same way' })
  latestEntry!: StatsTimeRecordDto | null;

  @ApiProperty({ type: StatsRecordEntryDto, nullable: true, description: 'The first entry, by date and then in the day’s order' })
  firstEntry!: StatsRecordEntryDto | null;
}

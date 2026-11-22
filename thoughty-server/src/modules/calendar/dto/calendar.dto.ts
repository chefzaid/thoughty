import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, Matches } from 'class-validator';
import { WritersTimeZone } from '@/common/validation';

/** How many imported calendar events one writer can keep. */
export const CALENDAR_EVENT_LIMIT = 10_000;
/** The largest calendar file an import takes. */
export const CALENDAR_FILE_MAX_SIZE = 5 * 1024 * 1024;
/** The most events the composer lists for one day. */
export const CALENDAR_DAY_EVENT_LIMIT = 50;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `POST /api/calendar/import`: the zone floating times are read in. */
export class CalendarImportQueryDto {
  @ApiPropertyOptional({
    example: 'Europe/Paris',
    maxLength: 64,
    description: 'The writer’s IANA time zone, which times without a zone of their own (or with a zone that is not an IANA name) are read in; UTC when left out',
  })
  @IsOptional()
  @WritersTimeZone()
  timeZone?: string;
}

/** `GET /api/calendar/events`: the day to list, in the writer's time zone. */
export class CalendarEventsQueryDto extends CalendarImportQueryDto {
  @ApiProperty({ example: '2026-11-22', format: 'date', description: 'The day whose events to list' })
  @IsString()
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true })
  date!: string;
}

export class CalendarEventResponseDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Dinner with Lina', description: 'Empty when the event has no title' })
  summary!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Le Petit Zinc' })
  location!: string | null;

  @ApiProperty({ example: false })
  allDay!: boolean;

  @ApiProperty({ type: String, nullable: true, format: 'date-time', example: '2026-11-22T19:30:00.000Z', description: 'A timed event’s start; null all day' })
  startsAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time', example: '2026-11-22T22:00:00.000Z', description: 'A timed event’s end; null all day' })
  endsAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, format: 'date', example: null, description: 'An all-day event’s first day; null for a timed event' })
  startDate!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date', example: null, description: 'An all-day event’s last day (included); null for a timed event' })
  endDate!: string | null;
}

export class CalendarDayResponseDto {
  @ApiProperty({ type: [CalendarEventResponseDto], description: `The day’s events, all-day ones first, then by start; at most ${CALENDAR_DAY_EVENT_LIMIT}` })
  events!: CalendarEventResponseDto[];
}

export class CalendarSummaryResponseDto {
  @ApiProperty({ example: 312, description: 'How many imported events the writer keeps' })
  eventCount!: number;

  @ApiProperty({ type: String, nullable: true, format: 'date-time', example: '2026-11-22T09:30:00.000Z', description: 'When a calendar was last imported; null without events' })
  lastImportedAt!: Date | null;

  @ApiProperty({ example: CALENDAR_EVENT_LIMIT, description: 'How many imported events a writer can keep' })
  limit!: number;
}

export class CalendarImportResponseDto {
  @ApiProperty({ example: 42, description: 'Events read from the file, added or updated' })
  imported!: number;

  @ApiProperty({ example: 3, description: 'Repeating events in the file, which are not imported' })
  skippedRecurring!: number;

  @ApiProperty({ example: 312, description: 'How many imported events the writer keeps now' })
  eventCount!: number;
}

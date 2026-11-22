import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { CalendarEvent } from '@/database/entities';
import {
  CALENDAR_DAY_EVENT_LIMIT,
  CALENDAR_EVENT_LIMIT,
  CalendarDayResponseDto,
  CalendarEventResponseDto,
  CalendarImportResponseDto,
  CalendarSummaryResponseDto,
} from './dto';
import { parseIcs, type ParsedCalendarEvent } from './ics-parser';

/** Namespace of the advisory lock that serializes one writer's imports, so the limit holds under concurrent requests. */
const CALENDAR_LOCK_NAMESPACE = 'calendar_events';
/** Rows written per statement: 9 parameters each, well under PostgreSQL's 65,535. */
const UPSERT_CHUNK = 500;

/**
 * The events of the calendar files (ICS) the writer imports, shown in the composer on their day. A file
 * imported again updates its events by their `UID`; events of other files stay until the writer removes
 * every imported event.
 */
@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepository: Repository<CalendarEvent>,
  ) {}

  async summary(userId: number): Promise<CalendarSummaryResponseDto> {
    const [row] = await this.eventRepository.query(
      'SELECT COUNT(*)::int AS "eventCount", MAX(updated_at) AS "lastImportedAt" FROM calendar_events WHERE user_id = $1',
      [userId],
    ) as { eventCount: number; lastImportedAt: Date | null }[];
    return { eventCount: row.eventCount, lastImportedAt: row.lastImportedAt, limit: CALENDAR_EVENT_LIMIT };
  }

  /**
   * The events on a day in the writer's zone: all-day events whose days include it, and timed events
   * that overlap it (one without a length when it starts that day), all-day first, then by start.
   */
  async eventsOn(userId: number, date: string, timeZone = 'UTC'): Promise<CalendarDayResponseDto> {
    const events = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.user_id = :userId', { userId })
      .andWhere(
        `((event.all_day AND event.start_date <= CAST(:date AS date) AND event.end_date >= CAST(:date AS date))
          OR (NOT event.all_day
            AND event.starts_at < (CAST(CAST(:date AS date) + 1 AS timestamp) AT TIME ZONE :timeZone)
            AND (event.ends_at > (CAST(:date AS timestamp) AT TIME ZONE :timeZone)
              OR event.starts_at >= (CAST(:date AS timestamp) AT TIME ZONE :timeZone))))`,
        { date, timeZone },
      )
      .orderBy('event.all_day', 'DESC')
      .addOrderBy('event.starts_at', 'ASC', 'NULLS FIRST')
      .addOrderBy('LOWER(event.summary)', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .limit(CALENDAR_DAY_EVENT_LIMIT)
      .getMany();
    return { events: events.map(toCalendarEventResponse) };
  }

  /** Reads a calendar file and adds its events, or updates those already imported; refused past the limit. */
  async import(userId: number, file: Express.Multer.File | undefined, timeZone = 'UTC'): Promise<CalendarImportResponseDto> {
    const calendar = file?.buffer ? parseIcs(file.buffer.toString('utf8'), timeZone) : null;
    if (!calendar) {
      throw apiError(BadRequestException, 'CALENDAR_FILE_INVALID');
    }
    const eventCount = await this.eventRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [CALENDAR_LOCK_NAMESPACE, userId]);
      const repository = manager.getRepository(CalendarEvent);
      const updatedAt = new Date();
      for (let start = 0; start < calendar.events.length; start += UPSERT_CHUNK) {
        const rows = calendar.events.slice(start, start + UPSERT_CHUNK).map((event) => toRow(userId, event, updatedAt));
        await repository.upsert(rows, ['userId', 'uid']);
      }
      const count = await repository.count({ where: { userId } });
      if (count > CALENDAR_EVENT_LIMIT) {
        throw apiError(BadRequestException, 'CALENDAR_EVENT_LIMIT_REACHED', `Calendar event limit reached (${CALENDAR_EVENT_LIMIT})`);
      }
      return count;
    });
    return { imported: calendar.events.length, skippedRecurring: calendar.skippedRecurring, eventCount };
  }

  /** Removes every imported event. */
  async clear(userId: number): Promise<{ success: boolean }> {
    await this.eventRepository.delete({ userId });
    return { success: true };
  }
}

function toRow(userId: number, event: ParsedCalendarEvent, updatedAt: Date): Partial<CalendarEvent> {
  return {
    userId,
    uid: event.uid,
    summary: event.summary,
    location: event.location,
    allDay: event.allDay,
    startsAt: event.allDay ? null : event.startsAt,
    endsAt: event.allDay ? null : event.endsAt,
    startDate: event.allDay ? event.startDate : null,
    endDate: event.allDay ? event.endDate : null,
    updatedAt,
  };
}

export function toCalendarEventResponse(event: CalendarEvent): CalendarEventResponseDto {
  return {
    id: event.id,
    summary: event.summary,
    location: event.location,
    allDay: event.allDay,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    startDate: event.startDate,
    endDate: event.endDate,
  };
}

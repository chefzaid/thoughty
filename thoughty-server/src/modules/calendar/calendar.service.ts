import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { CalendarEvent } from '@/database/entities';
import {
  CALENDAR_DAY_EVENT_LIMIT,
  CALENDAR_EVENT_LIMIT,
  CalendarDayResponseDto,
  CalendarDaysResponseDto,
  CalendarEventResponseDto,
  CalendarImportResponseDto,
  CalendarSummaryResponseDto,
} from './dto';
import { occurrenceOn } from './calendar-occurrences';
import { parseIcs, type ParsedCalendarEvent } from './ics-parser';

/** Namespace of the advisory lock that serializes one writer's imports, so the limit holds under concurrent requests. */
const CALENDAR_LOCK_NAMESPACE = 'calendar_events';
/** Rows written per statement: 9 parameters each, well under PostgreSQL's 65,535. */
const UPSERT_CHUNK = 500;

/**
 * The events of the calendar files (ICS) the writer imports, shown in the composer on their day, a
 * repeating event on each day it falls on. A file imported again updates its events by their `UID`;
 * events of other files stay until the writer removes every imported event.
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
   * that overlap it (one without a length when it starts that day), all-day first, then by start. A
   * repeating event is listed once, by its first occurrence on the day.
   */
  async eventsOn(userId: number, date: string, timeZone = 'UTC'): Promise<CalendarDayResponseDto> {
    const [oneOff, repeating] = await Promise.all([
      this.eventRepository
        .createQueryBuilder('event')
        .where('event.user_id = :userId', { userId })
        .andWhere('event.recurrence IS NULL')
        .andWhere(onDay('CAST(:date AS date)'), { date, timeZone })
        .orderBy('event.all_day', 'DESC')
        .addOrderBy('event.starts_at', 'ASC', 'NULLS FIRST')
        .addOrderBy('LOWER(event.summary)', 'ASC')
        .addOrderBy('event.id', 'ASC')
        .limit(CALENDAR_DAY_EVENT_LIMIT)
        .getMany(),
      this.repeatingBy(userId, date, timeZone),
    ]);
    return { events: dayEvents(oneOff, repeating, date, timeZone) };
  }

  /**
   * The events of several days at once (the days of the entries the journal shows), each listed as
   * {@link eventsOn} lists one day; only the days with events, in date order.
   */
  async eventsOnDays(userId: number, dates: readonly string[], timeZone = 'UTC'): Promise<CalendarDaysResponseDto> {
    const days = [...new Set(dates)].sort();
    const last = days.at(-1);
    if (!last) return { days: [] };
    const requestedDays = 'unnest(CAST(:days AS date[])) AS requested(day)';
    const [oneOff, repeating] = await Promise.all([
      this.eventRepository
        .createQueryBuilder('event')
        .addSelect(`ARRAY(SELECT CAST(requested.day AS text) FROM ${requestedDays} WHERE ${onDay('requested.day')})`, 'event_days')
        .where('event.user_id = :userId', { userId })
        .andWhere('event.recurrence IS NULL')
        .andWhere(`EXISTS (SELECT 1 FROM ${requestedDays} WHERE ${onDay('requested.day')})`, { days, timeZone })
        .getRawAndEntities<{ event_id: number; event_days: string[] }>(),
      this.repeatingBy(userId, last, timeZone),
    ]);
    const daysOf = new Map(oneOff.raw.map((row) => [row.event_id, row.event_days]));
    const oneOffOn = new Map<string, CalendarEvent[]>();
    for (const event of oneOff.entities) {
      for (const date of daysOf.get(event.id) ?? []) {
        const onDate = oneOffOn.get(date);
        if (onDate) onDate.push(event);
        else oneOffOn.set(date, [event]);
      }
    }
    return {
      days: days.flatMap((date) => {
        const events = dayEvents(oneOffOn.get(date) ?? [], repeating, date, timeZone);
        return events.length > 0 ? [{ date, events }] : [];
      }),
    };
  }

  /** Repeating events that start by the end of `date`; their occurrences are worked out here. */
  private repeatingBy(userId: number, date: string, timeZone: string): Promise<CalendarEvent[]> {
    return this.eventRepository
      .createQueryBuilder('event')
      .where('event.user_id = :userId', { userId })
      .andWhere('event.recurrence IS NOT NULL')
      .andWhere(
        `((event.all_day AND event.start_date <= CAST(:date AS date)) OR (NOT event.all_day AND event.starts_at < ${dayEnd('CAST(:date AS date)')}))`,
        { date, timeZone },
      )
      .getMany();
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

/** The instant a day (a SQL `date`) starts in the writer's zone (`:timeZone`). */
const dayStart = (day: string) => `(CAST(${day} AS timestamp) AT TIME ZONE :timeZone)`;
/** The instant the day after it starts. */
const dayEnd = (day: string) => `(CAST(${day} + 1 AS timestamp) AT TIME ZONE :timeZone)`;

/**
 * Whether a one-off event is on a day (a SQL `date`) in the writer's zone: an all-day event whose days
 * include it, or a timed event that overlaps it (one without a length when it starts that day).
 */
function onDay(day: string): string {
  return `((event.all_day AND event.start_date <= ${day} AND event.end_date >= ${day})
    OR (NOT event.all_day
      AND event.starts_at < ${dayEnd(day)}
      AND (event.ends_at > ${dayStart(day)} OR event.starts_at >= ${dayStart(day)})))`;
}

/** A day's one-off events with the day's occurrence of each repeating event, in the day's order, at most 50. */
function dayEvents(oneOff: CalendarEvent[], repeating: CalendarEvent[], date: string, timeZone: string): CalendarEventResponseDto[] {
  const occurrences = repeating.flatMap((event) => {
    const occurrence = occurrenceOn(event, date, timeZone);
    return occurrence ? [{ ...toCalendarEventResponse(event), ...occurrence }] : [];
  });
  return [...oneOff.map(toCalendarEventResponse), ...occurrences].sort(byDayOrder).slice(0, CALENDAR_DAY_EVENT_LIMIT);
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
    recurrence: event.recurrence,
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
    repeats: event.recurrence !== null,
  };
}

/** All-day events first, then by start, title (case aside) and id, as the day's query orders one-off events. */
function byDayOrder(left: CalendarEventResponseDto, right: CalendarEventResponseDto): number {
  if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
  const leftStart = left.startsAt?.getTime() ?? 0;
  const rightStart = right.startsAt?.getTime() ?? 0;
  if (leftStart !== rightStart) return leftStart - rightStart;
  const leftSummary = left.summary.toLowerCase();
  const rightSummary = right.summary.toLowerCase();
  if (leftSummary !== rightSummary) return leftSummary < rightSummary ? -1 : 1;
  return left.id - right.id;
}

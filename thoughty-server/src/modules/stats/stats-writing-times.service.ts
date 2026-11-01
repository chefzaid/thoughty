import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import type { StatsWritingTimesDto } from './dto';

/*
 * An entry's time of day was typed by the writer on their own clock, so it is already local and its
 * weekday is that of its date. Without one, the entry counts when it was created: `created_at` holds
 * the database session's wall clock (`now()` without a zone), so it is read back in that zone
 * (`::timestamptz`) and turned into the writer's.
 */
const CREATED_LOCAL_SQL = '(e.created_at::timestamptz AT TIME ZONE :timeZone)';
const HOUR_SQL = `CASE WHEN e.time_of_day IS NULL THEN EXTRACT(HOUR FROM ${CREATED_LOCAL_SQL}) ELSE EXTRACT(HOUR FROM e.time_of_day) END::int`;
const WEEKDAY_SQL = `CASE WHEN e.time_of_day IS NULL THEN EXTRACT(ISODOW FROM ${CREATED_LOCAL_SQL}) ELSE EXTRACT(ISODOW FROM e.date) END::int`;

/** When the writer writes: their entries by hour of the day and by weekday, in their time zone. */
@Injectable()
export class StatsWritingTimesService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  /** `timeZone` is already checked (`@WritersTimeZone()`); UTC without one. */
  async analyze(userId: number, diaryId?: number, timeZone = 'UTC'): Promise<StatsWritingTimesDto> {
    const query = this.entryRepository
      .createQueryBuilder('e')
      .select(HOUR_SQL, 'hour')
      .addSelect(WEEKDAY_SQL, 'weekday')
      .addSelect('COUNT(*)', 'entries')
      .where('e.user_id = :userId', { userId })
      .setParameter('timeZone', timeZone)
      .groupBy('hour')
      .addGroupBy('weekday');
    if (diaryId) {
      query.andWhere('e.diary_id = :diaryId', { diaryId });
    }
    const rows = await query.getRawMany<{ hour: string | number; weekday: string | number; entries: string }>();

    const hours = Array.from({ length: 24 }, () => 0);
    // ISO weekdays run from 1 (Monday) to 7 (Sunday); the list is Monday first, as the mood weekdays
    const weekdays = Array.from({ length: 7 }, () => 0);
    for (const row of rows) {
      const entries = Number(row.entries);
      hours[Number(row.hour)] += entries;
      weekdays[Number(row.weekday) - 1] += entries;
    }
    return { hours, weekdays };
  }
}

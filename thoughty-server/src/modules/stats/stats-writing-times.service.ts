import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import type { StatsWritingTimesDto } from './dto';
import { ENTRY_LOCAL_HOUR_SQL, ENTRY_LOCAL_WEEKDAY_SQL } from './stats-sql';

/**
 * When the writer writes: their entries by hour of the day and by weekday, in their time zone (a typed
 * time as it is, otherwise the creation time converted; see `stats-sql.ts`).
 */
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
      .select(ENTRY_LOCAL_HOUR_SQL, 'hour')
      .addSelect(ENTRY_LOCAL_WEEKDAY_SQL, 'weekday')
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

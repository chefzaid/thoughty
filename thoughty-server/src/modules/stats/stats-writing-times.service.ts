import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import type { StatsWritingTimesDto } from './dto';
import { ENTRY_LOCAL_HOUR_SQL, ENTRY_LOCAL_WEEKDAY_SQL } from './stats-sql';
import { readableEntrySql } from '@/common/content-lock';

/**
 * An imported entry without a time of day: its creation time is the import's moment, not when it was
 * written, so it is counted apart instead of piling up on one hour of one weekday.
 */
const UNTIMED_IMPORT_SQL = '(e.imported_at IS NOT NULL AND e.time_of_day IS NULL)';

/**
 * When the writer writes: their entries by hour of the day and by weekday, in their time zone (a typed
 * time as it is, otherwise the creation time converted; see `stats-sql.ts`), and how many imported
 * entries without a time are left out.
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
      .addSelect(UNTIMED_IMPORT_SQL, 'untimed_import')
      .addSelect('COUNT(*)', 'entries')
      .where('e.user_id = :userId', { userId })
      .andWhere(readableEntrySql(userId))
      .setParameter('timeZone', timeZone)
      .groupBy('hour')
      .addGroupBy('weekday')
      .addGroupBy('untimed_import');
    if (diaryId) {
      query.andWhere('e.diary_id = :diaryId', { diaryId });
    }
    const rows = await query.getRawMany<{
      hour: string | number;
      weekday: string | number;
      untimed_import: boolean;
      entries: string;
    }>();

    const hours = Array.from({ length: 24 }, () => 0);
    // ISO weekdays run from 1 (Monday) to 7 (Sunday); the list is Monday first, as the mood weekdays
    const weekdays = Array.from({ length: 7 }, () => 0);
    let untimedImports = 0;
    for (const row of rows) {
      const entries = Number(row.entries);
      if (row.untimed_import) {
        untimedImports += entries;
        continue;
      }
      hours[Number(row.hour)] += entries;
      weekdays[Number(row.weekday) - 1] += entries;
    }
    return { hours, weekdays, untimedImports };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { Entry } from '@/database/entities';
import { longestRun } from './diary-goal-progress';
import type { StatsBusiestDayDto, StatsLongestStreakDto, StatsRecordEntryDto, StatsRecordsDto } from './dto';
import { ENTRY_LOCAL_TIME_SQL, ENTRY_WORDS_SQL } from './stats-sql';

interface EntryRow {
  id: number | string;
  day: string;
  index: number | string;
}

const toRecordEntry = (row: EntryRow): StatsRecordEntryDto => ({
  entryId: Number(row.id),
  date: row.day,
  index: Number(row.index),
});

/** The day with the most entries, the earliest of days with as many; null without any. */
function busiestDay(entriesPerDay: Record<string, number>): StatsBusiestDayDto | null {
  let busiest: StatsBusiestDayDto | null = null;
  for (const [date, entries] of Object.entries(entriesPerDay)) {
    if (busiest === null || entries > busiest.entries || (entries === busiest.entries && date < busiest.date)) {
      busiest = { date, entries };
    }
  }
  return busiest;
}

/** The most days in a row with an entry, measured as the daily streak is; the earliest of runs as long. */
function longestStreak(entriesPerDay: Record<string, number>): StatsLongestStreakDto | null {
  const run = longestRun(Object.keys(entriesPerDay).sort((left, right) => left.localeCompare(right)), 1);
  return run ? { days: run.length, startDate: run.start, endDate: run.end } : null;
}

/**
 * The writer's personal records in one diary or all of them, without the recycle bin: their longest
 * entry, busiest day, longest streak, earliest and latest time of day written (in their time zone, as
 * **When you write** reads it) and their first entry.
 */
@Injectable()
export class StatsRecordsService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  /**
   * `entriesPerDay` is the scope's entries per `YYYY-MM-DD` date, which the stats have already counted.
   * `timeZone` is already checked (`@WritersTimeZone()`); UTC without one.
   */
  async analyze(
    userId: number,
    diaryId: number | undefined,
    entriesPerDay: Record<string, number>,
    timeZone = 'UTC',
  ): Promise<StatsRecordsDto> {
    const scoped = () => {
      const query = this.entryRepository
        .createQueryBuilder('e')
        .select('e.id', 'id')
        .addSelect("TO_CHAR(e.date, 'YYYY-MM-DD')", 'day')
        .addSelect('e.index', 'index')
        .where('e.user_id = :userId', { userId });
      return diaryId ? query.andWhere('e.diary_id = :diaryId', { diaryId }) : query;
    };
    // Equal records go to the first written: the earlier day, then the day's own order
    const first = <T extends SelectQueryBuilder<Entry>>(query: T) =>
      query.addOrderBy('e.date', 'ASC').addOrderBy('e.timeOfDay', 'ASC', 'NULLS FIRST').addOrderBy('e.index', 'ASC').limit(1);
    const atTime = (direction: 'ASC' | 'DESC') =>
      first(
        scoped()
          .addSelect(`TO_CHAR(${ENTRY_LOCAL_TIME_SQL}, 'HH24:MI')`, 'time')
          .setParameter('timeZone', timeZone)
          .orderBy(ENTRY_LOCAL_TIME_SQL, direction),
      ).getRawOne<EntryRow & { time: string }>();

    const [longest, earliest, latest, firstEntry] = await Promise.all([
      first(
        scoped()
          .addSelect(ENTRY_WORDS_SQL, 'words')
          .andWhere(`${ENTRY_WORDS_SQL} > 0`)
          .orderBy(ENTRY_WORDS_SQL, 'DESC'),
      ).getRawOne<EntryRow & { words: number | string }>(),
      atTime('ASC'),
      atTime('DESC'),
      first(scoped()).getRawOne<EntryRow>(),
    ]);

    return {
      longestEntry: longest ? { ...toRecordEntry(longest), words: Number(longest.words) } : null,
      busiestDay: busiestDay(entriesPerDay),
      longestStreak: longestStreak(entriesPerDay),
      earliestEntry: earliest ? { ...toRecordEntry(earliest), time: earliest.time } : null,
      latestEntry: latest ? { ...toRecordEntry(latest), time: latest.time } : null,
      firstEntry: firstEntry ? toRecordEntry(firstEntry) : null,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { MAX_MOOD } from '@/common/utils/entry-mood.util';
import type { StatsMoodDto } from './dto';

const TOP_FEELINGS = 10;

/** Moods of 4 (good) and 5 (very good) count as good; 3 (okay) is in neither list. */
export const GOOD_MOOD_MIN = 4;
/** Moods of 1 (very low) and 2 (low) count as low. */
export const LOW_MOOD_MAX = 2;
/** Each list of tags beside the moods shows at most this many tags. */
export const TOP_MOOD_TAGS = 5;
/** A tag on a single entry says little about a mood, so a tag needs this many entries to be listed. */
export const MIN_MOOD_TAG_ENTRIES = 2;

/** An average mood to one decimal, as the stats show it. */
export function roundMood(value: number | string | null | undefined): number | null {
  const parsed = Number(value);
  return value === null || value === undefined || Number.isNaN(parsed) ? null : Math.round(parsed * 10) / 10;
}

/**
 * The moods writers recorded themselves, summed up without AI: the average by month and by
 * weekday, how often each level was chosen, the feeling words used most, and the tags used most on
 * entries with a good mood and on those with a low one. Each entry counts by its own mood, so a day
 * with a good entry and a low one adds to both lists, and a tag can be in both lists. Sealed time
 * capsules keep no mood or tags on the entry and the recycle bin is left out, so neither counts.
 */
@Injectable()
export class StatsMoodService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async analyze(userId: number, diaryId?: number): Promise<StatsMoodDto> {
    const recorded = () => {
      const query = this.entryRepository
        .createQueryBuilder('e')
        .where('e.user_id = :userId', { userId })
        .andWhere('e.mood IS NOT NULL');
      return diaryId ? query.andWhere('e.diary_id = :diaryId', { diaryId }) : query;
    };
    const withFeelings = () => {
      const query = this.entryRepository
        .createQueryBuilder('e')
        .where('e.user_id = :userId', { userId })
        .andWhere('CARDINALITY(e.feelings) > 0');
      return diaryId ? query.andWhere('e.diary_id = :diaryId', { diaryId }) : query;
    };

    /** The tags on most entries whose mood meets `condition`, on at least two entries, most first. */
    const moodTags = (condition: string, mood: number) =>
      recorded()
        .andWhere(condition, { mood })
        .select('UNNEST(e.tags)', 'tag')
        .addSelect('COUNT(*)', 'entries')
        .groupBy('tag')
        .having('COUNT(*) >= :minimum', { minimum: MIN_MOOD_TAG_ENTRIES })
        .orderBy('entries', 'DESC')
        .addOrderBy('tag', 'ASC')
        .limit(TOP_MOOD_TAGS)
        .getRawMany<{ tag: string; entries: string }>();

    const [monthRows, weekdayRows, levelRows, feelingRows, goodTagRows, lowTagRows] = await Promise.all([
      recorded()
        .select("TO_CHAR(e.date, 'YYYY-MM')", 'month')
        .addSelect('AVG(e.mood)', 'average')
        .addSelect('COUNT(*)', 'entries')
        .groupBy("TO_CHAR(e.date, 'YYYY-MM')")
        .orderBy('month', 'ASC')
        .getRawMany<{ month: string; average: string; entries: string }>(),
      recorded()
        .select('EXTRACT(ISODOW FROM e.date)::int', 'weekday')
        .addSelect('AVG(e.mood)', 'average')
        .addSelect('COUNT(*)', 'entries')
        .groupBy('EXTRACT(ISODOW FROM e.date)')
        .getRawMany<{ weekday: string | number; average: string; entries: string }>(),
      recorded()
        .select('e.mood', 'level')
        .addSelect('COUNT(*)', 'entries')
        .groupBy('e.mood')
        .getRawMany<{ level: string | number; entries: string }>(),
      withFeelings()
        .select('UNNEST(e.feelings)', 'feeling')
        .addSelect('COUNT(*)', 'count')
        .groupBy('feeling')
        .orderBy('count', 'DESC')
        .addOrderBy('feeling', 'ASC')
        .limit(TOP_FEELINGS)
        .getRawMany<{ feeling: string; count: string }>(),
      moodTags('e.mood >= :mood', GOOD_MOOD_MIN),
      moodTags('e.mood <= :mood', LOW_MOOD_MAX),
    ]);

    const levels: number[] = Array.from({ length: MAX_MOOD }, () => 0);
    for (const row of levelRows) {
      levels[Number(row.level) - 1] = Number(row.entries);
    }
    const recordedEntries = levels.reduce((sum, count) => sum + count, 0);
    const total = levels.reduce((sum, count, index) => sum + count * (index + 1), 0);

    // ISO weekdays run from 1 (Monday) to 7 (Sunday); the list is Monday first, as in the year in review
    const weekdays = Array.from({ length: 7 }, () => ({ average: null as number | null, entries: 0 }));
    for (const row of weekdayRows) {
      weekdays[Number(row.weekday) - 1] = { average: roundMood(row.average), entries: Number(row.entries) };
    }

    return {
      recordedEntries,
      averageMood: recordedEntries > 0 ? roundMood(total / recordedEntries) : null,
      levels,
      months: monthRows.map((row) => ({ month: row.month, average: roundMood(row.average) ?? 0, entries: Number(row.entries) })),
      weekdays,
      topFeelings: feelingRows.map((row) => ({ feeling: row.feeling, count: Number(row.count) })),
      goodMoodTags: goodTagRows.map((row) => ({ tag: row.tag, entries: Number(row.entries) })),
      lowMoodTags: lowTagRows.map((row) => ({ tag: row.tag, entries: Number(row.entries) })),
    };
  }
}

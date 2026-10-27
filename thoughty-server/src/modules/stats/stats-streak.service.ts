import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { plainExcerpt } from '@/common/utils/plain-excerpt.util';
import { currentRun } from './diary-goal-progress';
import type { WritingStreakResponseDto } from './dto';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
/** Characters of the text read for the snippet, and the length of the snippet itself. */
const SNIPPET_SOURCE_LENGTH = 400;
const SNIPPET_LENGTH = 140;

/**
 * The writer's daily streak and their last entry, measured up to their own day, in one diary or all
 * of them. Entries in the recycle bin and entries dated after today are left out.
 */
@Injectable()
export class StatsStreakService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async getStreak(userId: number, diaryId: number | undefined, today: string): Promise<WritingStreakResponseDto> {
    const scoped = () => {
      const qb = this.entryRepository
        .createQueryBuilder('e')
        .where('e.user_id = :userId', { userId })
        .andWhere('e.date <= :today', { today });
      return diaryId ? qb.andWhere('e.diary_id = :diaryId', { diaryId }) : qb;
    };

    const [dayRows, lastEntry] = await Promise.all([
      scoped()
        .select("TO_CHAR(e.date, 'YYYY-MM-DD')", 'day')
        .groupBy('e.date')
        .getRawMany<{ day: string }>(),
      scoped()
        .select(['e.id', 'e.date', 'e.title'])
        .addSelect('LEFT(e.content, :snippetSource)', 'content_start')
        .setParameter('snippetSource', SNIPPET_SOURCE_LENGTH)
        .orderBy('e.date', 'DESC')
        .addOrderBy('e.timeOfDay', 'DESC', 'NULLS LAST')
        .addOrderBy('e.index', 'DESC')
        .limit(1)
        .getRawAndEntities<{ content_start: string | null }>(),
    ]);

    const days = new Set(dayRows.map((row) => row.day));
    const entry = lastEntry.entities[0];
    return {
      currentStreak: currentRun(days, today, 1),
      writtenToday: days.has(today),
      daysSinceLastEntry: entry ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${entry.date}T00:00:00Z`)) / DAY_IN_MS) : null,
      lastEntry: entry
        ? {
            id: entry.id,
            date: entry.date,
            title: entry.title ?? null,
            snippet: plainExcerpt(lastEntry.raw[0]?.content_start ?? '', SNIPPET_LENGTH),
          }
        : null,
    };
  }
}

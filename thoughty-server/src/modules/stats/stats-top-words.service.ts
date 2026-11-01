import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import type { StatsTopWordsDto } from './dto';
import { topWords } from './stats-words';

/** The list shows at most this many words. */
export const TOP_WORDS = 10;
/** A word used once says little, so a word needs this many uses to be listed. */
export const MIN_WORD_USES = 2;

/**
 * **Words you use most**: the words the writer used most this month, in one diary or all of them,
 * without common English and French words (`stats-words.ts`). Only this month's entries are read, from
 * the first of the writer's month up to their day, so entries dated later wait for their day. The
 * recycle bin is left out, and so are sealed time capsules: their text waits in `time_capsules`, and
 * they are skipped by name too, so their words cannot show before they open.
 */
@Injectable()
export class StatsTopWordsService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  /** `today` is the writer's day (`YYYY-MM-DD`), already checked by `@WritersDay()`. */
  async analyze(userId: number, diaryId: number | undefined, today: string): Promise<StatsTopWordsDto> {
    const month = today.slice(0, 7);
    const query = this.entryRepository
      .createQueryBuilder('e')
      .select('e.content', 'content')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.sealed_until IS NULL')
      .andWhere('e.date BETWEEN :monthStart AND :today', { monthStart: `${month}-01`, today });
    if (diaryId) {
      query.andWhere('e.diary_id = :diaryId', { diaryId });
    }
    const rows = await query.getRawMany<{ content: string | null }>();

    return { month, words: topWords(rows.map((row) => row.content ?? ''), TOP_WORDS, MIN_WORD_USES) };
  }
}

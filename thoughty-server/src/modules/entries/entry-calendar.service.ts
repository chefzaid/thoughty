import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { addSameDayOrder } from '@/common/utils';
import { plainExcerpt } from '@/common/utils/plain-excerpt.util';
import type { EntryCalendarResponseDto, GetEntryCalendarQueryDto } from './dto';
import { applyEntryListFilters } from './entry-list-filters';
import { EntrySearchService } from './entry-search.service';

/** Characters of the text read for a snippet, and the length of the snippet itself. */
const SNIPPET_SOURCE_LENGTH = 400;
const SNIPPET_LENGTH = 100;

/** The first day of the month after `YYYY-MM`, as `YYYY-MM-DD`. */
function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
}

/**
 * The journal calendar: a month's entries that match the journal filters, as short summaries (title,
 * the start of the text, time and mood) rather than whole entries, so a month grid loads in one light
 * request. Entries in the recycle bin are left out.
 */
@Injectable()
export class EntryCalendarService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly entrySearch: EntrySearchService,
  ) {}

  async getMonth(userId: number, query: GetEntryCalendarQueryDto): Promise<EntryCalendarResponseDto> {
    const { month, search } = query;
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .select(['e.id', 'e.diaryId', 'e.date', 'e.index', 'e.timeOfDay', 'e.title', 'e.mood'])
      .addSelect('LEFT(e.content, :snippetSource)', 'content_start')
      .setParameter('snippetSource', SNIPPET_SOURCE_LENGTH)
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date >= :monthStart AND e.date < :nextMonthStart', {
        monthStart: `${month}-01`,
        nextMonthStart: nextMonthStart(month),
      });

    const prepared = search ? await this.entrySearch.prepare(search) : null;
    applyEntryListFilters(qb, query, prepared);
    addSameDayOrder(qb.orderBy('e.date', 'ASC'), 'e');

    const { entities, raw } = await qb.getRawAndEntities<{ e_id: number; content_start: string | null }>();
    const textStarts = new Map(raw.map((row) => [Number(row.e_id), row.content_start ?? '']));

    return {
      month,
      entries: entities.map((entry) => ({
        id: entry.id,
        diary_id: entry.diaryId ?? null,
        date: entry.date,
        index: entry.index,
        time_of_day: entry.timeOfDay ?? null,
        title: entry.title ?? null,
        snippet: plainExcerpt(textStarts.get(entry.id) ?? '', SNIPPET_LENGTH),
        mood: entry.mood ?? null,
      })),
    };
  }
}

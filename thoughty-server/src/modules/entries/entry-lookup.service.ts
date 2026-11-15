import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { addSameDayOrder } from '@/common/utils';
import { GetFirstEntryQueryDto, GetEntryByDateQueryDto, EntryBacklinksResponseDto } from './dto';
import { entryContentReferencesTarget } from './entry-references.util';
import { applyEntryListFilters, applyEntryMonthFilter } from './entry-list-filters';
import { EntrySearchService } from './entry-search.service';

/**
 * Finding one entry in the journal: the first entry of a year or month, an entry by its date and
 * same-day index (or id), and the entries that refer to it. The list opens around the entry found.
 */
@Injectable()
export class EntryLookupService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly entrySearch: EntrySearchService,
  ) {}

  /**
   * The first entry (oldest day first, then the day's order) of a year or month among the journal filters,
   * which the journal opens the list around, and the years and months that hold any entry.
   */
  async getFirstEntry(
    userId: number,
    query: GetFirstEntryQueryDto,
  ): Promise<{
    found: boolean;
    entryId?: number;
    years: number[];
    months: string[];
  }> {
    const { year, month } = query;

    const [yearsResult, monthsResult] = await Promise.all([
      this.entryRepository
        .createQueryBuilder('e')
        .select('DISTINCT EXTRACT(YEAR FROM e.date)', 'year')
        .where('e.user_id = :userId', { userId })
        .orderBy('year', 'DESC')
        .getRawMany(),
      this.entryRepository
        .createQueryBuilder('e')
        .select("DISTINCT TO_CHAR(e.date, 'YYYY-MM')", 'month')
        .where('e.user_id = :userId', { userId })
        .orderBy('month', 'DESC')
        .getRawMany(),
    ]);
    const years = yearsResult.map((result) => Number.parseInt(result.year, 10));
    const months = monthsResult.map((result) => result.month);

    if (!year) {
      return { found: false, years, months };
    }

    const firstEntryQb = addSameDayOrder(
      this.entryRepository
        .createQueryBuilder('e')
        .select('e.id')
        .where('e.user_id = :userId', { userId })
        .orderBy('e.date', 'ASC'),
      'e',
    ).limit(1);
    applyEntryListFilters(firstEntryQb, query, query.search ? await this.entrySearch.prepare(query.search) : null);

    if (month) {
      applyEntryMonthFilter(firstEntryQb, `${year}-${String(month).padStart(2, '0')}`);
    } else {
      firstEntryQb.andWhere('EXTRACT(YEAR FROM e.date) = :year', { year });
    }

    const firstEntryId: number | undefined = (await firstEntryQb.getRawOne())?.e_id;
    return firstEntryId ? { found: true, entryId: firstEntryId, years, months } : { found: false, years, months };
  }

  async getEntryByDate(
    userId: number,
    query: GetEntryByDateQueryDto,
  ): Promise<{
    found: boolean;
    entry?: Entry;
    entryId?: number;
    error?: string;
  }> {
    const { date, index = 1, id } = query;

    let entry: Entry | null;

    if (id) {
      entry = await this.entryRepository.findOne({
        where: { userId, id },
      });
    } else {
      if (!date) {
        return { found: false, error: 'Date is required' };
      }
      entry = await this.entryRepository.findOne({
        where: { userId, date, index },
      });
    }

    if (!entry) {
      return { found: false, error: 'Entry not found' };
    }

    return { found: true, entry, entryId: entry.id };
  }

  async getBacklinks(userId: number, entryId: number): Promise<EntryBacklinksResponseDto> {
    const targetEntry = await this.entryRepository.findOne({
      where: { id: entryId, userId },
    });

    if (!targetEntry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    const targetDate = this.normalizeEntryDate(targetEntry.date);
    const targetIndex = targetEntry.index || 1;

    const candidates = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.id != :entryId', { entryId })
      .andWhere('e.content ILIKE :targetDate', { targetDate: `%${targetDate}%` })
      .orderBy('e.date', 'DESC');
    addSameDayOrder(candidates, 'e');

    return {
      backlinks: (await candidates.getMany())
        .filter((entry) => entryContentReferencesTarget(entry.content, targetDate, targetIndex))
        .map((entry) => ({
          id: entry.id,
          date: entry.date,
          index: entry.index,
          title: entry.title ?? null,
          time_of_day: entry.timeOfDay ?? null,
          tags: entry.tags,
          content: entry.content,
          format: entry.format,
          visibility: entry.visibility,
          is_favorite: entry.isFavorite,
          is_archived: entry.isArchived,
          is_pinned: entry.isPinned,
          diary_name: entry.diary?.name,
          diary_icon: entry.diary?.icon,
          diary_color: entry.diary?.color ?? undefined,
        })),
    };
  }

  private normalizeEntryDate(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString().slice(0, 10);
    }

    const dateString = String(date);
    return dateString.includes('T') ? dateString.split('T')[0] : dateString;
  }
}

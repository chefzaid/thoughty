import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { addSameDayOrder } from '@/common/utils';
import { GetFirstEntryQueryDto, GetEntryByDateQueryDto, EntryBacklinksResponseDto } from './dto';
import { entryContentReferencesTarget } from './entry-references.util';

/**
 * Finding one entry and its place in the journal: the first entry of a year or month, an entry by
 * its date and same-day index (or id) with the page that shows it, and the entries that refer to it.
 */
@Injectable()
export class EntryLookupService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async getFirstEntry(
    userId: number,
    query: GetFirstEntryQueryDto,
  ): Promise<{
    page: number;
    found: boolean;
    entryId?: number;
    years: number[];
    months: string[];
  }> {
    const { year, month, limit = 10 } = query;

    const yearsResult = await this.entryRepository
      .createQueryBuilder('e')
      .select('DISTINCT EXTRACT(YEAR FROM e.date)', 'year')
      .where('e.user_id = :userId', { userId })
      .orderBy('year', 'DESC')
      .getRawMany();
    const years = yearsResult.map((result) => Number.parseInt(result.year, 10));

    const monthsResult = await this.entryRepository
      .createQueryBuilder('e')
      .select("DISTINCT TO_CHAR(e.date, 'YYYY-MM')", 'month')
      .where('e.user_id = :userId', { userId })
      .orderBy('month', 'DESC')
      .getRawMany();
    const months = monthsResult.map((result) => result.month);

    if (!year) {
      return { page: 1, found: false, years, months };
    }

    let firstEntryQb = this.entryRepository
      .createQueryBuilder('e')
      .select('MIN(e.date)', 'first_date')
      .where('e.user_id = :userId', { userId });

    if (month) {
      const monthStr = String(month).padStart(2, '0');
      firstEntryQb = firstEntryQb.andWhere("TO_CHAR(e.date, 'YYYY-MM') = :dateFilter", {
        dateFilter: `${year}-${monthStr}`,
      });
    } else {
      firstEntryQb = firstEntryQb.andWhere('EXTRACT(YEAR FROM e.date) = :year', { year });
    }

    const firstEntryResult = await firstEntryQb.getRawOne();

    if (!firstEntryResult?.first_date) {
      return { page: 1, found: false, years, months };
    }

    const firstDate = firstEntryResult.first_date;

    let firstEntryIdQb = addSameDayOrder(
      this.entryRepository
        .createQueryBuilder('e')
        .select('e.id')
        .where('e.user_id = :userId', { userId })
        .orderBy('e.date', 'ASC'),
      'e',
    ).limit(1);

    if (month) {
      const monthStr = String(month).padStart(2, '0');
      firstEntryIdQb = firstEntryIdQb.andWhere("TO_CHAR(e.date, 'YYYY-MM') = :dateFilter", {
        dateFilter: `${year}-${monthStr}`,
      });
    } else {
      firstEntryIdQb = firstEntryIdQb.andWhere('EXTRACT(YEAR FROM e.date) = :year', { year });
    }

    const firstEntryIdResult = await firstEntryIdQb.getRawOne();
    const firstEntryId = firstEntryIdResult?.e_id;

    const countResult = await this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date > :firstDate', { firstDate })
      .getCount();

    const page = Math.floor(countResult / limit) + 1;

    return { page, found: true, entryId: firstEntryId, years, months };
  }

  async getEntryByDate(
    userId: number,
    query: GetEntryByDateQueryDto,
  ): Promise<{
    found: boolean;
    entry?: Entry;
    page?: number;
    entryId?: number;
    error?: string;
  }> {
    const { date, index = 1, id, limit = 10 } = query;

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

    const totalBefore = await this.countEntriesBefore(entry);
    const page = Math.floor(totalBefore / limit) + 1;

    return { found: true, entry, page, entryId: entry.id };
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

  /** Entries listed before this one in the journal: pinned ones first, then newest day first, then the day's order. */
  private countEntriesBefore(entry: Entry): Promise<number> {
    const earlierInDay =
      '(e.date > :date OR (e.date = :date AND ' +
      "(e.time_of_day IS NOT NULL, COALESCE(e.time_of_day, TIME '00:00'), e.index) < " +
      "(CAST(:hasTime AS boolean), COALESCE(CAST(:timeOfDay AS time), TIME '00:00'), CAST(:index AS integer))))";
    const params = {
      date: entry.date,
      hasTime: entry.timeOfDay !== null && entry.timeOfDay !== undefined,
      timeOfDay: entry.timeOfDay ?? null,
      index: entry.index,
    };
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId: entry.userId });

    if (entry.isPinned) {
      qb.andWhere('e.is_pinned = true').andWhere(earlierInDay, params);
    } else {
      qb.andWhere(`(e.is_pinned = true OR (e.is_pinned = false AND ${earlierInDay}))`, params);
    }

    return qb.getCount();
  }

  private normalizeEntryDate(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString().slice(0, 10);
    }

    const dateString = String(date);
    return dateString.includes('T') ? dateString.split('T')[0] : dateString;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, Diary } from '@/database/entities';
import { sanitizeString } from '@/common/utils';
import {
  CreateEntryDto,
  UpdateEntryDto,
  GetEntriesQueryDto,
  GetFirstEntryQueryDto,
  GetEntryByDateQueryDto,
  GetHighlightsQueryDto,
  EntriesListResponseDto,
} from './dto';

@Injectable()
export class EntriesService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
  ) {}

  async getEntries(userId: number, query: GetEntriesQueryDto): Promise<EntriesListResponseDto> {
    const { search, tags, date, visibility, diaryId, page = 1, limit = 10 } = query;

    const qb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId });

    if (search) {
      qb.andWhere('(e.content ILIKE :search OR :searchTerm = ANY(e.tags))', {
        search: `%${search}%`,
        searchTerm: search,
      });
    }

    if (tags) {
      const tagList = tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);
      if (tagList.length > 0) {
        qb.andWhere('e.tags @> :tagList', { tagList });
      }
    }

    if (date) {
      qb.andWhere('e.date = :date', { date });
    }

    if (visibility && ['public', 'private'].includes(visibility)) {
      qb.andWhere('e.visibility = :visibility', { visibility });
    }

    if (diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId });
    }

    const total = await qb.getCount();

    qb.orderBy('e.date', 'DESC').addOrderBy('e.index', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const entries = await qb.getMany();

    // Get all tags for the filter
    const tagsResult = await this.entryRepository
      .createQueryBuilder('e')
      .select('DISTINCT UNNEST(e.tags)', 'tag')
      .where('e.user_id = :userId', { userId })
      .getRawMany();

    const allTags = tagsResult.map((r) => r.tag).sort();

    return {
      entries: entries.map((e) => ({
        id: e.id,
        user_id: e.userId,
        diary_id: e.diaryId,
        date: e.date,
        index: e.index,
        tags: e.tags,
        content: e.content,
        visibility: e.visibility,
        diary_name: e.diary?.name,
        diary_icon: e.diary?.icon,
        created_at: e.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      allTags,
    };
  }

  async getDates(userId: number): Promise<{ dates: string[] }> {
    const result = await this.entryRepository
      .createQueryBuilder('e')
      .select("DISTINCT TO_CHAR(e.date, 'YYYY-MM-DD')", 'date')
      .where('e.user_id = :userId', { userId })
      .orderBy('date', 'DESC')
      .getRawMany();

    return { dates: result.map((r) => r.date) };
  }

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

    // Get available years
    const yearsResult = await this.entryRepository
      .createQueryBuilder('e')
      .select('DISTINCT EXTRACT(YEAR FROM e.date)', 'year')
      .where('e.user_id = :userId', { userId })
      .orderBy('year', 'DESC')
      .getRawMany();
    const years = yearsResult.map((r) => Number.parseInt(r.year, 10));

    // Get available months
    const monthsResult = await this.entryRepository
      .createQueryBuilder('e')
      .select("DISTINCT TO_CHAR(e.date, 'YYYY-MM')", 'month')
      .where('e.user_id = :userId', { userId })
      .orderBy('month', 'DESC')
      .getRawMany();
    const months = monthsResult.map((r) => r.month);

    if (!year) {
      return { page: 1, found: false, years, months };
    }

    // Find the first entry date in the target period
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

    // Get the first entry's ID
    let firstEntryIdQb = this.entryRepository
      .createQueryBuilder('e')
      .select('e.id')
      .where('e.user_id = :userId', { userId })
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.index', 'ASC')
      .limit(1);

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

    // Count entries after this date
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

    // Count entries after this date
    const countNewer = await this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date > :date', { date: entry.date })
      .getCount();

    // Count entries on the same date with lower indexes
    const sameDateCount = await this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date = :date', { date: entry.date })
      .andWhere('e.index < :index', { index: entry.index })
      .getCount();

    const totalBefore = countNewer + sameDateCount;
    const page = Math.floor(totalBefore / limit) + 1;

    return { found: true, entry, page, entryId: entry.id };
  }

  async create(userId: number, dto: CreateEntryDto): Promise<{ success: boolean }> {
    const sanitizedTags = dto.tags.map((tag: string) => sanitizeString(tag.trim()).substring(0, 50));

    const dateStr = dto.date || new Date().toISOString().split('T')[0];

    // Get diary ID
    let targetDiaryId = dto.diaryId;
    if (!targetDiaryId) {
      const defaultDiary = await this.diaryRepository.findOne({
        where: { userId, isDefault: true },
      });
      targetDiaryId = defaultDiary?.id;
    }

    // Calculate next index for the day
    const countResult = await this.entryRepository.count({
      where: { userId, date: dateStr },
    });
    const nextIndex = countResult + 1;

    await this.entryRepository.save({
      userId,
      date: dateStr,
      index: nextIndex,
      tags: sanitizedTags,
      content: dto.text,
      visibility: dto.visibility || 'private',
      diaryId: targetDiaryId,
    });

    return { success: true };
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateEntryDto,
  ): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({
      where: { id, userId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    const sanitizedTags = dto.tags.map((tag: string) => sanitizeString(tag.trim()).substring(0, 50));
    const oldDate = entry.date;
    let newIndex = entry.index;

    // If date is changing, recalculate index
    if (oldDate !== dto.date) {
      const countResult = await this.entryRepository.count({
        where: { userId, date: dto.date },
      });
      newIndex = countResult + 1;
    }

    entry.content = dto.text;
    entry.tags = sanitizedTags;
    entry.date = dto.date;
    entry.visibility = dto.visibility || 'private';
    entry.index = newIndex;

    const updated = await this.entryRepository.save(entry);

    // If date changed, reindex old date's entries
    if (oldDate !== dto.date) {
      const remainingEntries = await this.entryRepository.find({
        where: { userId, date: oldDate },
        order: { index: 'ASC' },
      });

      for (let i = 0; i < remainingEntries.length; i++) {
        remainingEntries[i].index = i + 1;
        await this.entryRepository.save(remainingEntries[i]);
      }
    }

    return { success: true, entry: updated };
  }

  async updateVisibility(
    userId: number,
    id: number,
    visibility: 'public' | 'private',
  ): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({
      where: { id, userId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    entry.visibility = visibility;
    const updated = await this.entryRepository.save(entry);

    return { success: true, entry: updated };
  }

  async getHighlights(
    userId: number,
    query: GetHighlightsQueryDto,
  ): Promise<{
    randomEntry: Entry | null;
    onThisDay: Record<number, Entry[]>;
    currentDate: { month: string; day: string; year: number };
  }> {
    const { diaryId } = query;
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    const currentYear = today.getFullYear();

    // Get a random entry
    let randomQb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId })
      .orderBy('RANDOM()')
      .limit(1);

    if (diaryId) {
      randomQb = randomQb.andWhere('e.diary_id = :diaryId', { diaryId });
    }

    const randomEntry = await randomQb.getOne();

    // Get entries from this day in previous years
    let onThisDayQb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .addSelect('EXTRACT(YEAR FROM e.date)', 'entry_year')
      .where('e.user_id = :userId', { userId })
      .andWhere("TO_CHAR(e.date, 'MM-DD') = :mmdd", { mmdd: `${currentMonth}-${currentDay}` })
      .andWhere('EXTRACT(YEAR FROM e.date) < :currentYear', { currentYear })
      .orderBy('e.date', 'DESC')
      .limit(10);

    if (diaryId) {
      onThisDayQb = onThisDayQb.andWhere('e.diary_id = :diaryId', { diaryId });
    }

    const onThisDayEntries = await onThisDayQb.getRawAndEntities();

    // Group by years ago
    const onThisDay: Record<number, Entry[]> = {};
    for (let i = 0; i < onThisDayEntries.entities.length; i++) {
      const entry = onThisDayEntries.entities[i];
      const entryYear = Number.parseInt(onThisDayEntries.raw[i].entry_year, 10);
      const yearsAgo = currentYear - entryYear;

      if (!onThisDay[yearsAgo]) {
        onThisDay[yearsAgo] = [];
      }
      onThisDay[yearsAgo].push(entry);
    }

    return {
      randomEntry,
      onThisDay,
      currentDate: { month: currentMonth, day: currentDay, year: currentYear },
    };
  }

  async deleteAll(userId: number, diaryId?: number): Promise<{ success: boolean; deletedCount: number }> {
    let deleteQb = this.entryRepository
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId });

    if (diaryId) {
      deleteQb = deleteQb.andWhere('diary_id = :diaryId', { diaryId });
    }

    const result = await deleteQb.execute();

    return { success: true, deletedCount: result.affected || 0 };
  }

  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    const entry = await this.entryRepository.findOne({
      where: { id, userId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    const entryDate = entry.date;

    await this.entryRepository.delete({ id, userId });

    // Reindex remaining entries for that date
    const remainingEntries = await this.entryRepository.find({
      where: { userId, date: entryDate },
      order: { index: 'ASC' },
    });

    for (let i = 0; i < remainingEntries.length; i++) {
      remainingEntries[i].index = i + 1;
      await this.entryRepository.save(remainingEntries[i]);
    }

    return { success: true };
  }
}

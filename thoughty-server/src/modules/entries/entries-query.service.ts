import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, EntryRevision } from '@/database/entities';
import {
  GetEntriesQueryDto,
  GetFirstEntryQueryDto,
  GetEntryByDateQueryDto,
  GetHighlightsQueryDto,
  EntriesListResponseDto,
  EntryBacklinksResponseDto,
} from './dto';
import { entryContentReferencesTarget } from './entry-references.util';

@Injectable()
export class EntriesQueryService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(EntryRevision)
    private readonly revisionRepository: Repository<EntryRevision>,
  ) {}

  async getEntries(userId: number, query: GetEntriesQueryDto): Promise<EntriesListResponseDto> {
    const {
      search,
      tags,
      date,
      visibility,
      favorites,
      archiveStatus,
      diaryId,
      page = 1,
      limit = 10,
    } = query;

    const qb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .leftJoinAndSelect('e.attachments', 'a')
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
        .map((tag: string) => tag.trim())
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

    if (favorites) {
      qb.andWhere('e.is_favorite = true');
    }

    if (archiveStatus === 'active') {
      qb.andWhere('e.is_archived = false');
    } else if (archiveStatus === 'archived') {
      qb.andWhere('e.is_archived = true');
    }

    const totalPromise = qb.getCount();

    qb.orderBy('e.is_pinned', 'DESC')
      .addOrderBy('e.date', 'DESC')
      .addOrderBy('e.index', 'ASC');
    qb.skip((page - 1) * limit).take(limit);

    const entriesPromise = qb.getMany();
    const tagsPromise = this.entryRepository
      .createQueryBuilder('e')
      .select('DISTINCT UNNEST(e.tags)', 'tag')
      .where('e.user_id = :userId', { userId })
      .getRawMany();

    const [total, entries, tagsResult] = await Promise.all([totalPromise, entriesPromise, tagsPromise]);

    const allTags = tagsResult.map((result) => result.tag).sort((left, right) => left.localeCompare(right));

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        user_id: entry.userId,
        diary_id: entry.diaryId,
        date: entry.date,
        index: entry.index,
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
        created_at: entry.createdAt,
        attachments: (entry.attachments || []).map((attachment) => ({
          id: attachment.id,
          original_filename: attachment.originalFilename,
          stored_filename: attachment.storedFilename,
          mimetype: attachment.mimetype,
          size: attachment.size,
        })),
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

    return { dates: result.map((row) => row.date) };
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
      throw new NotFoundException('Entry not found');
    }

    const targetDate = this.normalizeEntryDate(targetEntry.date);
    const targetIndex = targetEntry.index || 1;

    const candidates = await this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.id != :entryId', { entryId })
      .andWhere('e.content ILIKE :targetDate', { targetDate: `%${targetDate}%` })
      .orderBy('e.date', 'DESC')
      .addOrderBy('e.index', 'ASC')
      .getMany();

    return {
      backlinks: candidates
        .filter((entry) => entryContentReferencesTarget(entry.content, targetDate, targetIndex))
        .map((entry) => ({
          id: entry.id,
          date: entry.date,
          index: entry.index,
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

    let randomQb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId })
      .orderBy('RANDOM()')
      .limit(1);

    if (diaryId) {
      randomQb = randomQb.andWhere('e.diary_id = :diaryId', { diaryId });
    }

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

    const [randomEntry, onThisDayEntries] = await Promise.all([
      randomQb.getOne(),
      onThisDayQb.getRawAndEntities(),
    ]);

    const onThisDay: Record<number, Entry[]> = {};
    for (let index = 0; index < onThisDayEntries.entities.length; index++) {
      const entry = onThisDayEntries.entities[index];
      const entryYear = Number.parseInt(onThisDayEntries.raw[index].entry_year, 10);
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

  async getRevisions(userId: number, entryId: number): Promise<EntryRevision[]> {
    const entry = await this.entryRepository.findOne({
      where: { id: entryId, userId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    return this.revisionRepository.find({
      where: { entryId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  private countEntriesBefore(entry: Entry): Promise<number> {
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId: entry.userId });

    if (entry.isPinned) {
      qb.andWhere('e.is_pinned = true')
        .andWhere('(e.date > :date OR (e.date = :date AND e.index < :index))', {
          date: entry.date,
          index: entry.index,
        });
    } else {
      qb.andWhere(
        '(e.is_pinned = true OR (e.is_pinned = false AND (e.date > :date OR (e.date = :date AND e.index < :index))))',
        {
          date: entry.date,
          index: entry.index,
        },
      );
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

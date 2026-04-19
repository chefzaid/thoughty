import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry, EntryRevision, Diary } from '@/database/entities';
import { sanitizeString } from '@/common/utils';
import { AiService } from '@/modules/ai';
import { ConfigService } from '@/modules/config';
import {
  CreateEntryDto,
  UpdateEntryDto,
  GetEntriesQueryDto,
  GetFirstEntryQueryDto,
  GetEntryByDateQueryDto,
  GetHighlightsQueryDto,
  BulkOperationDto,
  EntriesListResponseDto,
} from './dto';

@Injectable()
export class EntriesService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(EntryRevision)
    private readonly revisionRepository: Repository<EntryRevision>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
  ) {}

  private async resolveSavedTags(userId: number, text: string, rawTags: string[]): Promise<string[]> {
    const sanitizedTags = [...new Set(rawTags
      .map((tag: string) => sanitizeString(tag.trim()).substring(0, 50))
      .filter(Boolean))];

    const config = await this.configService.getConfig(userId);
    const autoTagMaxTags = Number.parseInt(String(config.autoTagMaxTags || '0'), 10);

    if (!Number.isFinite(autoTagMaxTags) || autoTagMaxTags <= 0 || sanitizedTags.length >= autoTagMaxTags) {
      return sanitizedTags;
    }

    const suggestedTags = await this.aiService.autoTagEntry(
      userId,
      text,
      sanitizedTags,
      autoTagMaxTags - sanitizedTags.length,
    );

    return [...sanitizedTags, ...suggestedTags];
  }

  async getEntries(userId: number, query: GetEntriesQueryDto): Promise<EntriesListResponseDto> {
    const { search, tags, date, visibility, favorites, diaryId, page = 1, limit = 10 } = query;

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

    if (favorites) {
      qb.andWhere('e.is_favorite = true');
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
        format: e.format,
        visibility: e.visibility,
        is_favorite: e.isFavorite,
        diary_name: e.diary?.name,
        diary_icon: e.diary?.icon,
        created_at: e.createdAt,
        attachments: (e.attachments || []).map((a) => ({
          id: a.id,
          original_filename: a.originalFilename,
          stored_filename: a.storedFilename,
          mimetype: a.mimetype,
          size: a.size,
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

  async create(userId: number, dto: CreateEntryDto): Promise<{ success: boolean; entryId: number }> {
    const resolvedTags = await this.resolveSavedTags(userId, dto.text, dto.tags);

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

    const entry = await this.entryRepository.save({
      userId,
      date: dateStr,
      index: nextIndex,
      tags: resolvedTags,
      content: dto.text,
      format: dto.format || 'plain',
      visibility: dto.visibility || 'private',
      diaryId: targetDiaryId,
    });

    return { success: true, entryId: entry.id };
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

    // Save revision of the current state before modifying
    await this.revisionRepository.save({
      entryId: entry.id,
      userId: entry.userId,
      content: entry.content,
      tags: entry.tags,
      date: entry.date,
      format: entry.format,
      visibility: entry.visibility,
    });

    const resolvedTags = await this.resolveSavedTags(userId, dto.text, dto.tags);
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
  entry.tags = resolvedTags;
    entry.date = dto.date;
    entry.format = dto.format || entry.format;
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

  async toggleFavorite(
    userId: number,
    id: number,
    isFavorite: boolean,
  ): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({
      where: { id, userId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    entry.isFavorite = isFavorite;
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

  async bulkOperation(
    userId: number,
    dto: BulkOperationDto,
  ): Promise<{ success: boolean; affectedCount: number }> {
    // Verify all entries belong to the user
    const entries = await this.entryRepository.find({
      where: { userId, id: In(dto.ids) },
    });

    if (entries.length === 0) {
      throw new NotFoundException('No matching entries found');
    }

    const validIds = entries.map((e) => e.id);

    switch (dto.action) {
      case 'delete':
        return this.bulkDelete(userId, entries, validIds);
      case 'visibility':
        return this.bulkUpdateVisibility(userId, validIds, dto.visibility);
      case 'tags':
        return this.bulkAddTags(entries, dto.tags);
      case 'move':
        return this.bulkMove(userId, validIds, dto.diaryId);
      default:
        throw new BadRequestException('Invalid action');
    }
  }

  private async bulkDelete(
    userId: number,
    entries: Entry[],
    validIds: number[],
  ): Promise<{ success: boolean; affectedCount: number }> {
    const affectedDates = [...new Set(entries.map((e) => e.date))];

    await this.entryRepository.delete({ id: In(validIds), userId });

    for (const date of affectedDates) {
      const remaining = await this.entryRepository.find({
        where: { userId, date },
        order: { index: 'ASC' },
      });
      for (let i = 0; i < remaining.length; i++) {
        remaining[i].index = i + 1;
        await this.entryRepository.save(remaining[i]);
      }
    }

    return { success: true, affectedCount: validIds.length };
  }

  private async bulkUpdateVisibility(
    userId: number,
    validIds: number[],
    visibility?: 'public' | 'private',
  ): Promise<{ success: boolean; affectedCount: number }> {
    if (!visibility) {
      throw new BadRequestException('Visibility value is required');
    }

    await this.entryRepository.update(
      { id: In(validIds), userId },
      { visibility },
    );

    return { success: true, affectedCount: validIds.length };
  }

  private async bulkAddTags(
    entries: Entry[],
    tags?: string[],
  ): Promise<{ success: boolean; affectedCount: number }> {
    if (!tags) {
      throw new BadRequestException('Tags are required');
    }

    const sanitizedTags = tags.map((tag: string) =>
      sanitizeString(tag.trim()).substring(0, 50),
    );

    for (const entry of entries) {
      const mergedTags = [...new Set([...entry.tags, ...sanitizedTags])];
      entry.tags = mergedTags.slice(0, 20);
      await this.entryRepository.save(entry);
    }

    return { success: true, affectedCount: entries.length };
  }

  private async bulkMove(
    userId: number,
    validIds: number[],
    diaryId?: number,
  ): Promise<{ success: boolean; affectedCount: number }> {
    if (diaryId === undefined || diaryId === null) {
      throw new BadRequestException('Diary ID is required');
    }

    const diary = await this.diaryRepository.findOne({
      where: { id: diaryId, userId },
    });

    if (!diary) {
      throw new NotFoundException('Target diary not found');
    }

    await this.entryRepository.update(
      { id: In(validIds), userId },
      { diaryId },
    );

    return { success: true, affectedCount: validIds.length };
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

  async deleteRevision(userId: number, entryId: number, revisionId: number): Promise<{ success: boolean }> {
    const revision = await this.revisionRepository.findOne({
      where: { id: revisionId, entryId, userId },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    await this.revisionRepository.remove(revision);
    return { success: true };
  }
}

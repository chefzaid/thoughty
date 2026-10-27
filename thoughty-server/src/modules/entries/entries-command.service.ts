import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry, EntryRevision, Diary } from '@/database/entities';
import { normalizeEntryTitle, normalizeFeelings, normalizeMood, normalizeTimeOfDay, sanitizeString } from '@/common/utils';
import { ConfigService } from '@/modules/config';
import { CreateEntryDto, UpdateEntryDto, BulkOperationDto } from './dto';
import { EntryTaggingService } from './entry-tagging.service';
import { EntryMentionsService } from './entry-mentions.service';

const DEFAULT_MAX_PINNED_ENTRIES = 3;

/** The writer's pinned-entry limit from their `maxPinnedEntries` setting: 3 by default, at most 20. */
export function resolveMaxPinnedEntries(setting?: string | null): number {
  const parsedLimit = Number.parseInt(setting ?? '', 10);

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    return DEFAULT_MAX_PINNED_ENTRIES;
  }

  return Math.min(parsedLimit, 20);
}

/** The entry as it is now, to keep in its history before it changes. */
export function entryRevisionSnapshot(entry: Entry): Partial<EntryRevision> {
  return {
    entryId: entry.id,
    userId: entry.userId,
    content: entry.content,
    title: entry.title,
    timeOfDay: entry.timeOfDay,
    mood: entry.mood,
    feelings: entry.feelings ?? [],
    tags: entry.tags,
    date: entry.date,
    format: entry.format,
    visibility: entry.visibility,
  };
}

function countOutsideBin(entries: Entry[]): number {
  return entries.filter((entry) => !entry.deletedAt).length;
}

@Injectable()
export class EntriesCommandService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(EntryRevision)
    private readonly revisionRepository: Repository<EntryRevision>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly entryTaggingService: EntryTaggingService,
    private readonly configService: ConfigService,
    private readonly entryMentions: EntryMentionsService,
  ) {}

  private sanitizeTagName(tag?: string | null): string {
    return sanitizeString(String(tag ?? '').trim()).substring(0, 50);
  }

  async create(userId: number, dto: CreateEntryDto): Promise<{ success: boolean; entryId: number }> {
    const targetDiaryId = await this.resolveTargetDiaryId(userId, dto.diaryId);
    const resolvedTags = await this.entryTaggingService.resolveSavedTags(userId, dto.text, dto.tags);
    const dateStr = dto.date || new Date().toISOString().split('T')[0];

    const countResult = await this.entryRepository.count({
      where: { userId, date: dateStr },
    });
    const nextIndex = countResult + 1;

    // A new entry is numbered after the day's entries whatever its time, so existing links keep their targets
    const entry = await this.entryMentions.save(userId, {
      userId,
      date: dateStr,
      index: nextIndex,
      title: normalizeEntryTitle(dto.title),
      timeOfDay: normalizeTimeOfDay(dto.timeOfDay),
      mood: normalizeMood(dto.mood),
      feelings: normalizeFeelings(dto.feelings),
      tags: resolvedTags,
      content: dto.text,
      format: dto.format || 'plain',
      visibility: dto.visibility || 'private',
      diaryId: targetDiaryId,
    });

    return { success: true, entryId: entry.id };
  }

  /** A requested diary must belong to the writer; without one, the entry goes to their default diary. */
  private async resolveTargetDiaryId(userId: number, diaryId?: number): Promise<number | undefined> {
    if (diaryId) {
      const diary = await this.diaryRepository.findOne({ where: { id: diaryId, userId } });
      if (!diary) {
        throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
      }
      return diary.id;
    }

    const defaultDiary = await this.diaryRepository.findOne({ where: { userId, isDefault: true } });
    return defaultDiary?.id;
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
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    await this.revisionRepository.save(entryRevisionSnapshot(entry));

    const resolvedTags = await this.entryTaggingService.resolveSavedTags(userId, dto.text, dto.tags);
    const oldDate = entry.date;
    let newIndex = entry.index;

    if (oldDate !== dto.date) {
      const countResult = await this.entryRepository.count({
        where: { userId, date: dto.date },
      });
      newIndex = countResult + 1;
    }

    entry.content = dto.text;
    if (dto.title !== undefined) {
      entry.title = normalizeEntryTitle(dto.title);
    }
    if (dto.timeOfDay !== undefined) {
      entry.timeOfDay = normalizeTimeOfDay(dto.timeOfDay);
    }
    if (dto.mood !== undefined) {
      entry.mood = normalizeMood(dto.mood);
    }
    if (dto.feelings !== undefined) {
      entry.feelings = normalizeFeelings(dto.feelings);
    }
    entry.tags = resolvedTags;
    entry.date = dto.date;
    entry.format = dto.format || entry.format;
    entry.visibility = dto.visibility || 'private';
    entry.index = newIndex;

    const updated = await this.entryMentions.save(userId, entry);

    if (oldDate !== dto.date) {
      const remainingEntries = await this.entryRepository.find({
        where: { userId, date: oldDate },
        order: { index: 'ASC' },
      });

      for (let index = 0; index < remainingEntries.length; index++) {
        remainingEntries[index].index = index + 1;
        await this.entryRepository.save(remainingEntries[index]);
      }
    }

    return { success: true, entry: updated };
  }

  async updateVisibility(
    userId: number,
    id: number,
    visibility: 'public' | 'private',
  ): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    entry.visibility = visibility;
    const updated = await this.entryRepository.save(entry);
    return { success: true, entry: updated };
  }

  async toggleFavorite(userId: number, id: number, isFavorite: boolean): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    entry.isFavorite = isFavorite;
    const updated = await this.entryRepository.save(entry);
    return { success: true, entry: updated };
  }

  async toggleArchived(userId: number, id: number, isArchived: boolean): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    entry.isArchived = isArchived;
    const updated = await this.entryRepository.save(entry);
    return { success: true, entry: updated };
  }

  async togglePinned(userId: number, id: number, isPinned: boolean): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    if (isPinned && !entry.isPinned) {
      const maxPinnedEntries = await this.getMaxPinnedEntries(userId);
      const pinnedCount = await this.entryRepository.count({
        where: { userId, isPinned: true },
      });

      if (pinnedCount >= maxPinnedEntries) {
        throw apiError(BadRequestException, 'ENTRY_PIN_LIMIT_REACHED', `Pinned entry limit reached (${maxPinnedEntries})`);
      }
    }

    entry.isPinned = isPinned;
    const updated = await this.entryRepository.save(entry);
    return { success: true, entry: updated };
  }

  /** Moves every entry in scope to the recycle bin; entries already there keep their deletion time. */
  async deleteAll(userId: number, diaryId?: number): Promise<{ success: boolean; deletedCount: number }> {
    let deleteQb = this.entryRepository
      .createQueryBuilder()
      .softDelete()
      .where('user_id = :userId', { userId })
      .andWhere('deleted_at IS NULL');

    if (diaryId) {
      deleteQb = deleteQb.andWhere('diary_id = :diaryId', { diaryId });
    }

    const result = await deleteQb.execute();
    return { success: true, deletedCount: result.affected || 0 };
  }

  /** Moves the entry to the recycle bin and closes the gap it leaves in its day. */
  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    const entryDate = entry.date;
    await this.entryRepository.softDelete({ id, userId });

    const remainingEntries = await this.entryRepository.find({
      where: { userId, date: entryDate },
      order: { index: 'ASC' },
    });

    for (let index = 0; index < remainingEntries.length; index++) {
      remainingEntries[index].index = index + 1;
      await this.entryRepository.save(remainingEntries[index]);
    }

    return { success: true };
  }

  async bulkOperation(userId: number, dto: BulkOperationDto): Promise<{ success: boolean; affectedCount: number }> {
    const entries = await this.entryRepository.find({ where: { userId, id: In(dto.ids) } });

    if (entries.length === 0) {
      throw apiError(NotFoundException, 'ENTRIES_NOT_FOUND');
    }

    const validIds = entries.map((entry) => entry.id);

    switch (dto.action) {
      case 'delete':
        return this.bulkDelete(userId, entries, validIds);
      case 'visibility':
        return this.bulkUpdateVisibility(userId, validIds, dto.visibility);
      case 'tags':
        return this.bulkAddTags(entries, dto.tags);
      case 'move':
        return this.bulkMove(userId, validIds, dto.diaryId);
      case 'archive':
        return this.bulkUpdateArchived(userId, validIds, dto.isArchived);
      default:
        throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Invalid action');
    }
  }

  async renameTag(userId: number, oldTag: string, newTag: string): Promise<{ success: boolean; affectedCount: number }> {
    const sourceTag = this.sanitizeTagName(oldTag);
    const targetTag = this.sanitizeTagName(newTag);

    if (!sourceTag || !targetTag) {
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Both old and new tags are required');
    }

    if (sourceTag === targetTag) {
      throw apiError(BadRequestException, 'TAG_RENAME_SAME_NAME');
    }

    // Entries in the recycle bin follow the rename too, so restoring one never brings the old tag back
    const entries = await this.entryRepository
      .createQueryBuilder('e')
      .withDeleted()
      .where('e.user_id = :userId', { userId })
      .andWhere(':sourceTag = ANY(e.tags)', { sourceTag })
      .getMany();

    if (entries.length === 0) {
      throw apiError(NotFoundException, 'TAG_NOT_FOUND');
    }

    for (const entry of entries) {
      entry.tags = [...new Set(entry.tags.map((tag) => (tag === sourceTag ? targetTag : tag)))].slice(0, 20);
      await this.entryRepository.save(entry);
    }

    return { success: true, affectedCount: countOutsideBin(entries) };
  }

  async deleteTag(userId: number, tag: string): Promise<{ success: boolean; affectedCount: number }> {
    const targetTag = this.sanitizeTagName(tag);
    if (!targetTag) {
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Tag is required');
    }

    const entries = await this.entryRepository
      .createQueryBuilder('e')
      .withDeleted()
      .where('e.user_id = :userId', { userId })
      .andWhere(':targetTag = ANY(e.tags)', { targetTag })
      .getMany();

    for (const entry of entries) {
      entry.tags = entry.tags.filter((current) => current !== targetTag);
      await this.entryRepository.save(entry);
    }

    return { success: true, affectedCount: countOutsideBin(entries) };
  }

  /**
   * Puts the listed entries of a day in the given order. They trade the same-day indexes they
   * already hold, so listing only some of the day's entries (those without a time, whose order is
   * manual) leaves the others' indexes alone. Entries with a time still show in time order.
   */
  async reorderEntries(userId: number, date: string, orderedIds: number[]): Promise<{ success: boolean }> {
    const entries = await this.entryRepository.find({
      where: { userId, date },
      order: { index: 'ASC' },
    });

    const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
    const uniqueIds = [...new Set(orderedIds)];

    for (const id of uniqueIds) {
      if (!entryMap.has(id)) {
        throw apiError(BadRequestException, 'ENTRY_NOT_FOUND', `Entry ${id} not found for this date`);
      }
    }

    const reordered = uniqueIds.map((id) => entryMap.get(id) as Entry);
    const indexes = reordered.map((entry) => entry.index).sort((left, right) => left - right);

    for (const [position, entry] of reordered.entries()) {
      if (entry.index !== indexes[position]) {
        entry.index = indexes[position];
        await this.entryRepository.save(entry);
      }
    }

    return { success: true };
  }

  async deleteRevision(userId: number, entryId: number, revisionId: number): Promise<{ success: boolean }> {
    const revision = await this.revisionRepository.findOne({
      where: { id: revisionId, entryId, userId },
    });

    if (!revision) {
      throw apiError(NotFoundException, 'ENTRY_REVISION_NOT_FOUND');
    }

    await this.revisionRepository.remove(revision);
    return { success: true };
  }

  private async bulkDelete(
    userId: number,
    entries: Entry[],
    validIds: number[],
  ): Promise<{ success: boolean; affectedCount: number }> {
    const affectedDates = [...new Set(entries.map((entry) => entry.date))];

    await this.entryRepository.softDelete({ id: In(validIds), userId });

    for (const date of affectedDates) {
      const remaining = await this.entryRepository.find({
        where: { userId, date },
        order: { index: 'ASC' },
      });
      for (let index = 0; index < remaining.length; index++) {
        remaining[index].index = index + 1;
        await this.entryRepository.save(remaining[index]);
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
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Visibility value is required');
    }

    await this.entryRepository.update({ id: In(validIds), userId }, { visibility });
    return { success: true, affectedCount: validIds.length };
  }

  private async bulkAddTags(entries: Entry[], tags?: string[]): Promise<{ success: boolean; affectedCount: number }> {
    if (!tags) {
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Tags are required');
    }

    const sanitizedTags = tags.map((tag: string) => sanitizeString(tag.trim()).substring(0, 50));

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
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Diary ID is required');
    }

    const diary = await this.diaryRepository.findOne({ where: { id: diaryId, userId } });
    if (!diary) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND', 'Target diary not found');
    }

    await this.entryRepository.update({ id: In(validIds), userId }, { diaryId });
    return { success: true, affectedCount: validIds.length };
  }

  private async bulkUpdateArchived(
    userId: number,
    validIds: number[],
    isArchived?: boolean,
  ): Promise<{ success: boolean; affectedCount: number }> {
    if (typeof isArchived !== 'boolean') {
      throw apiError(BadRequestException, 'VALIDATION_FAILED', 'Archive value is required');
    }

    await this.entryRepository.update({ id: In(validIds), userId }, { isArchived });
    return { success: true, affectedCount: validIds.length };
  }

  private async getMaxPinnedEntries(userId: number): Promise<number> {
    const config = await this.configService.getConfig(userId);
    return resolveMaxPinnedEntries(config.maxPinnedEntries);
  }
}

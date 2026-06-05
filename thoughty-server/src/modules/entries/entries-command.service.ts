import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry, EntryRevision, Diary } from '@/database/entities';
import { sanitizeString } from '@/common/utils';
import { CreateEntryDto, UpdateEntryDto, BulkOperationDto } from './dto';
import { EntryTaggingService } from './entry-tagging.service';

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
  ) {}

  private sanitizeTagName(tag?: string | null): string {
    return sanitizeString(String(tag ?? '').trim()).substring(0, 50);
  }

  async create(userId: number, dto: CreateEntryDto): Promise<{ success: boolean; entryId: number }> {
    const resolvedTags = await this.entryTaggingService.resolveSavedTags(userId, dto.text, dto.tags);
    const dateStr = dto.date || new Date().toISOString().split('T')[0];

    let targetDiaryId = dto.diaryId;
    if (!targetDiaryId) {
      const defaultDiary = await this.diaryRepository.findOne({
        where: { userId, isDefault: true },
      });
      targetDiaryId = defaultDiary?.id;
    }

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

    await this.revisionRepository.save({
      entryId: entry.id,
      userId: entry.userId,
      content: entry.content,
      tags: entry.tags,
      date: entry.date,
      format: entry.format,
      visibility: entry.visibility,
    });

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
    entry.tags = resolvedTags;
    entry.date = dto.date;
    entry.format = dto.format || entry.format;
    entry.visibility = dto.visibility || 'private';
    entry.index = newIndex;

    const updated = await this.entryRepository.save(entry);

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
      throw new NotFoundException('Entry not found');
    }

    entry.visibility = visibility;
    const updated = await this.entryRepository.save(entry);
    return { success: true, entry: updated };
  }

  async toggleFavorite(userId: number, id: number, isFavorite: boolean): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    entry.isFavorite = isFavorite;
    const updated = await this.entryRepository.save(entry);
    return { success: true, entry: updated };
  }

  async toggleArchived(userId: number, id: number, isArchived: boolean): Promise<{ success: boolean; entry: Entry }> {
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    entry.isArchived = isArchived;
    const updated = await this.entryRepository.save(entry);
    return { success: true, entry: updated };
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
    const entry = await this.entryRepository.findOne({ where: { id, userId } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    const entryDate = entry.date;
    await this.entryRepository.delete({ id, userId });

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
      throw new NotFoundException('No matching entries found');
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
        throw new BadRequestException('Invalid action');
    }
  }

  async renameTag(userId: number, oldTag: string, newTag: string): Promise<{ success: boolean; affectedCount: number }> {
    const sourceTag = this.sanitizeTagName(oldTag);
    const targetTag = this.sanitizeTagName(newTag);

    if (!sourceTag || !targetTag) {
      throw new BadRequestException('Both old and new tags are required');
    }

    if (sourceTag === targetTag) {
      throw new BadRequestException('New tag name must be different');
    }

    const entries = await this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere(':sourceTag = ANY(e.tags)', { sourceTag })
      .getMany();

    if (entries.length === 0) {
      throw new NotFoundException('No entries found with that tag');
    }

    for (const entry of entries) {
      entry.tags = [...new Set(entry.tags.map((tag) => (tag === sourceTag ? targetTag : tag)))].slice(0, 20);
      await this.entryRepository.save(entry);
    }

    return { success: true, affectedCount: entries.length };
  }

  async reorderEntries(userId: number, date: string, orderedIds: number[]): Promise<{ success: boolean }> {
    const entries = await this.entryRepository.find({
      where: { userId, date },
      order: { index: 'ASC' },
    });

    const entryMap = new Map(entries.map((entry) => [entry.id, entry]));

    for (const id of orderedIds) {
      if (!entryMap.has(id)) {
        throw new BadRequestException(`Entry ${id} not found for this date`);
      }
    }

    for (let index = 0; index < orderedIds.length; index++) {
      const entry = entryMap.get(orderedIds[index]);
      if (entry && entry.index !== index + 1) {
        entry.index = index + 1;
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
      throw new NotFoundException('Revision not found');
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

    await this.entryRepository.delete({ id: In(validIds), userId });

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
      throw new BadRequestException('Visibility value is required');
    }

    await this.entryRepository.update({ id: In(validIds), userId }, { visibility });
    return { success: true, affectedCount: validIds.length };
  }

  private async bulkAddTags(entries: Entry[], tags?: string[]): Promise<{ success: boolean; affectedCount: number }> {
    if (!tags) {
      throw new BadRequestException('Tags are required');
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
      throw new BadRequestException('Diary ID is required');
    }

    const diary = await this.diaryRepository.findOne({ where: { id: diaryId, userId } });
    if (!diary) {
      throw new NotFoundException('Target diary not found');
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
      throw new BadRequestException('Archive value is required');
    }

    await this.entryRepository.update({ id: In(validIds), userId }, { isArchived });
    return { success: true, affectedCount: validIds.length };
  }
}
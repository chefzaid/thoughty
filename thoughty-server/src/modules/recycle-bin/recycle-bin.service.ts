import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, MoreThanOrEqual, Not, Repository, type EntityManager, type SelectQueryBuilder } from 'typeorm';
import { Attachment, Diary, Entry } from '@/database/entities';
import { AttachmentsService, storedKeysOf } from '@/modules/attachments';
import { ConfigService } from '@/modules/config';
import { resolveMaxPinnedEntries } from '@/modules/entries';
import {
  RECYCLE_BIN_RETENTION_DAYS,
  RecycleBinListResponseDto,
  RecycleBinRestoreResponseDto,
  TrashedEntryDto,
} from './dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 100;

type BinScope = (qb: SelectQueryBuilder<Entry>) => SelectQueryBuilder<Entry>;

export interface RestoreOptions {
  /** Puts each entry back where it was in its day instead of at the end of it: the undo right after a delete. */
  readonly inPlace?: boolean;
}

/** When an entry deleted at `deletedAt` leaves the recycle bin for good. */
export function purgeDateFor(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + RECYCLE_BIN_RETENTION_DAYS * DAY_MS);
}

/**
 * Deleted entries wait here for 30 days with their revisions, attachments, chat, and memoir
 * link. Restoring puts them back at the end of their day (or, for an undo, where they were in it); removing them, by hand or once the
 * 30 days are up, deletes the rows and their files in object storage.
 */
@Injectable()
export class RecycleBinService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly attachmentsService: AttachmentsService,
    private readonly configService: ConfigService,
  ) {}

  /** The writer's bin, most recently deleted first. */
  async list(userId: number, page = 1, limit = 20): Promise<RecycleBinListResponseDto> {
    const [entries, total] = await this.entryRepository
      .createQueryBuilder('e')
      .withDeleted()
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.deleted_at IS NOT NULL')
      .orderBy('e.deletedAt', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const attachmentCounts = await this.countAttachments(entries.map((entry) => entry.id));

    return {
      entries: entries.map((entry) => this.toDto(entry, attachmentCounts.get(entry.id) ?? 0)),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      retentionDays: RECYCLE_BIN_RETENTION_DAYS,
    };
  }

  /** Restores the chosen entries, or every entry in the bin when no IDs are given. */
  async restore(userId: number, ids?: number[], options: RestoreOptions = {}): Promise<RecycleBinRestoreResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const qb = manager
        .getRepository(Entry)
        .createQueryBuilder('e')
        .withDeleted()
        .where('e.user_id = :userId', { userId })
        .andWhere('e.deleted_at IS NOT NULL')
        .orderBy('e.date', 'ASC')
        .addOrderBy('e.index', 'ASC')
        .addOrderBy('e.id', 'ASC')
        .setLock('pessimistic_write');
      if (ids) {
        qb.andWhere('e.id IN (:...ids)', { ids });
      }

      const trashed = await qb.getMany();
      if (trashed.length === 0) {
        throw apiError(NotFoundException, 'RECYCLE_BIN_ENTRIES_NOT_FOUND');
      }
      return this.putBack(manager, userId, trashed, options.inPlace === true);
    });
  }

  /** Removes the chosen entries for good, or the whole bin when no IDs are given. */
  async deletePermanently(userId: number, ids?: number[]): Promise<number> {
    const deletedCount = await this.purge((qb) => {
      qb.andWhere('e.user_id = :userId', { userId });
      return ids ? qb.andWhere('e.id IN (:...ids)', { ids }) : qb;
    });

    if (ids && deletedCount === 0) {
      throw apiError(NotFoundException, 'RECYCLE_BIN_ENTRIES_NOT_FOUND');
    }
    return deletedCount;
  }

  /** Removes everything that has been in any bin for longer than the retention period. */
  async purgeExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RECYCLE_BIN_RETENTION_DAYS * DAY_MS);
    let purged = 0;

    for (;;) {
      const batch = await this.purge((qb) =>
        qb.andWhere('e.deleted_at <= :cutoff', { cutoff }).orderBy('e.deletedAt', 'ASC').limit(PURGE_BATCH_SIZE),
      );
      purged += batch;
      if (batch < PURGE_BATCH_SIZE) {
        return purged;
      }
    }
  }

  /**
   * Deletes the scoped bin entries (revisions, attachment rows, chat, comments, likes, and memoir
   * links go with them through foreign keys), then their files once the rows are gone. Rows another
   * run is already removing are skipped.
   */
  private async purge(scope: BinScope): Promise<number> {
    const { count, storedFilenames } = await this.dataSource.transaction(async (manager) => {
      const rows = await scope(
        manager
          .getRepository(Entry)
          .createQueryBuilder('e')
          .withDeleted()
          .select(['e.id'])
          .where('e.deleted_at IS NOT NULL'),
      )
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      const ids = rows.map((row) => row.id);
      if (ids.length === 0) {
        return { count: 0, storedFilenames: [] as string[] };
      }

      const attachments = await manager.find(Attachment, {
        select: { id: true, storedFilename: true, posterFilename: true },
        where: { entryId: In(ids) },
      });
      await manager.delete(Entry, { id: In(ids) });
      return { count: ids.length, storedFilenames: storedKeysOf(attachments) };
    });

    await this.attachmentsService.removeStoredFiles(storedFilenames);
    return count;
  }

  /**
   * Puts entries back at the end of their day, in their original order, or with `inPlace` at the
   * position they held in it (the entries after it move down one; deleting closed that gap). An
   * entry whose diary is gone goes to the default diary; one whose import reference is taken again
   * (the export was imported after the delete) loses the reference; a pinned one stays pinned while
   * the limit allows.
   */
  private async putBack(
    manager: EntityManager,
    userId: number,
    trashed: Entry[],
    inPlace: boolean,
  ): Promise<RecycleBinRestoreResponseDto> {
    const entries = manager.getRepository(Entry);
    const diaries = await manager.find(Diary, { where: { userId } });
    const diaryIds = new Set(diaries.map((diary) => diary.id));
    const defaultDiaryId = diaries.find((diary) => diary.isDefault)?.id ?? null;

    const dayCounts = await this.countLiveEntriesByDate(manager, userId, trashed.map((entry) => entry.date));
    const importRefs = trashed.map((entry) => entry.importRef).filter((ref): ref is string => Boolean(ref));
    const takenRefs = new Set(
      importRefs.length > 0
        ? (await entries.find({ select: { id: true, importRef: true }, where: { userId, importRef: In(importRefs) } }))
          .map((entry) => entry.importRef)
        : [],
    );
    const maxPinned = resolveMaxPinnedEntries((await this.configService.getConfig(userId)).maxPinnedEntries);
    let pinnedCount = trashed.some((entry) => entry.isPinned)
      ? await entries.count({ where: { userId, isPinned: true } })
      : 0;

    let movedToDefaultCount = 0;
    for (const entry of trashed) {
      const dayCount = dayCounts.get(entry.date) ?? 0;
      const index = inPlace ? Math.min(Math.max(entry.index, 1), dayCount + 1) : dayCount + 1;
      if (index <= dayCount) {
        await entries.increment({ userId, date: entry.date, deletedAt: IsNull(), index: MoreThanOrEqual(index) }, 'index', 1);
      }
      dayCounts.set(entry.date, dayCount + 1);

      const diaryId = entry.diaryId !== null && diaryIds.has(entry.diaryId) ? entry.diaryId : defaultDiaryId;
      if (diaryId !== entry.diaryId) {
        movedToDefaultCount += 1;
      }

      const importRef = entry.importRef && !takenRefs.has(entry.importRef) ? entry.importRef : null;
      if (importRef) {
        takenRefs.add(importRef);
      }

      const isPinned = entry.isPinned && pinnedCount < maxPinned;
      if (isPinned) {
        pinnedCount += 1;
      }

      await entries.update({ id: entry.id, userId, deletedAt: Not(IsNull()) }, {
        deletedAt: null,
        index,
        diaryId,
        importRef,
        isPinned,
      });
    }

    return { success: true, restoredCount: trashed.length, movedToDefaultCount };
  }

  private async countLiveEntriesByDate(manager: EntityManager, userId: number, dates: string[]): Promise<Map<string, number>> {
    const rows: Array<{ date: string; count: string }> = await manager
      .getRepository(Entry)
      .createQueryBuilder('e')
      .select(`to_char(e.date, 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date IN (:...dates)', { dates: [...new Set(dates)] })
      .groupBy('e.date')
      .getRawMany();
    return new Map(rows.map((row) => [row.date, Number(row.count)]));
  }

  private async countAttachments(entryIds: number[]): Promise<Map<number, number>> {
    if (entryIds.length === 0) {
      return new Map();
    }

    const rows: Array<{ entryId: number | string; count: number | string }> = await this.attachmentRepository
      .createQueryBuilder('a')
      .select('a.entry_id', 'entryId')
      .addSelect('COUNT(*)', 'count')
      .where('a.entry_id IN (:...entryIds)', { entryIds })
      .groupBy('a.entry_id')
      .getRawMany();
    return new Map(rows.map((row) => [Number(row.entryId), Number(row.count)]));
  }

  /** A sealed time capsule shows only its date, time and diary until it opens. */
  private toDto(entry: Entry, attachmentCount: number): TrashedEntryDto {
    const deletedAt = entry.deletedAt as Date;
    const sealed = Boolean(entry.sealedUntil);
    return {
      id: entry.id,
      date: entry.date,
      title: sealed ? null : (entry.title ?? null),
      timeOfDay: entry.timeOfDay ?? null,
      content: sealed ? '' : entry.content,
      format: entry.format,
      tags: sealed ? [] : entry.tags,
      diaryId: entry.diary ? entry.diaryId : null,
      diaryName: entry.diary?.name ?? null,
      diaryIcon: entry.diary?.icon ?? null,
      diaryColor: entry.diary?.color ?? null,
      attachmentCount,
      sealedUntil: entry.sealedUntil ? entry.sealedUntil.toISOString() : null,
      deletedAt: deletedAt.toISOString(),
      purgeAt: purgeDateFor(deletedAt).toISOString(),
    };
  }
}

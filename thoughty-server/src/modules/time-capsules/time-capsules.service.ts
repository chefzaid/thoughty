import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type DeepPartial, type EntityManager, In, IsNull, Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { Entry, TimeCapsule } from '@/database/entities';
import { syncEntryMentions } from '@/modules/entries/entry-mentions.sync';
import { scheduleTimeCapsule, type TimeCapsuleRequest } from './time-capsule-schedule';

/** How many days Highlights shows a capsule after it opens. */
export const OPENED_CAPSULE_HIGHLIGHT_DAYS = 7;
/** Opened capsules Highlights shows at most. */
const OPENED_CAPSULE_HIGHLIGHT_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Tags an entry keeps at most, as everywhere else. */
const MAX_ENTRY_TAGS = 20;

/**
 * Time capsules: sealing a new entry until a chosen local date and hour, opening it then or early, and
 * giving exports the sealed text back. A sealed entry row holds no title, text, tags, mood or feelings;
 * they wait in `time_capsules` until it opens, so nothing that reads entries can show them.
 */
@Injectable()
export class TimeCapsuleService {
  constructor(
    @InjectRepository(TimeCapsule)
    private readonly capsuleRepository: Repository<TimeCapsule>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  /**
   * Saves a new entry sealed until the requested time: the entry row keeps its date, time, diary and
   * format, stays private, and holds an empty text; what was written goes into the capsule. One transaction.
   */
  async createSealed(userId: number, written: DeepPartial<Entry>, request: TimeCapsuleRequest, now = new Date()): Promise<Entry> {
    const result = scheduleTimeCapsule(request, now);
    if ('error' in result) {
      throw result.error === 'time-zone'
        ? apiError(BadRequestException, 'VALIDATION_FAILED', 'Unknown time zone')
        : apiError(BadRequestException, 'TIME_CAPSULE_DATE_INVALID');
    }
    const { schedule } = result;

    return this.entryRepository.manager.transaction(async (manager) => {
      const entry = await manager.getRepository(Entry).save({
        ...written,
        userId,
        title: null,
        content: '',
        tags: [],
        mood: null,
        feelings: [],
        visibility: 'private',
        sealedUntil: schedule.openAt,
      });
      await manager.getRepository(TimeCapsule).insert({
        entryId: entry.id,
        userId,
        ...schedule,
        sealedTitle: written.title ?? null,
        sealedContent: written.content ?? '',
        sealedTags: (written.tags as string[] | undefined) ?? [],
        sealedMood: written.mood ?? null,
        sealedFeelings: (written.feelings as string[] | undefined) ?? [],
      });
      return entry;
    });
  }

  /** Opens one of the writer's sealed entries now, at their request; it is not emailed. */
  async openEarly(userId: number, entryId: number, now = new Date()): Promise<Entry> {
    return this.entryRepository.manager.transaction(async (manager) => {
      const entry = await manager.getRepository(Entry).findOne({ where: { id: entryId, userId } });
      if (!entry) {
        throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
      }
      const capsule = await manager.getRepository(TimeCapsule).findOne({
        where: { entryId, openedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entry.sealedUntil || !capsule) {
        throw apiError(ConflictException, 'ENTRY_NOT_SEALED');
      }
      return this.openCapsule(manager, capsule, now);
    });
  }

  /**
   * Moves a sealed capsule's title, text, tags, mood and feelings back into its entry, links the people
   * its text mentions, and keeps only when it opened, inside the caller's transaction. Tags given to the
   * entry while it was sealed are kept after the sealed ones.
   */
  async openCapsule(manager: EntityManager, capsule: TimeCapsule, now: Date): Promise<Entry> {
    const entries = manager.getRepository(Entry);
    const entry = await entries.findOneOrFail({ where: { id: capsule.entryId }, withDeleted: true });
    entry.title = capsule.sealedTitle;
    entry.content = capsule.sealedContent ?? '';
    entry.tags = [...new Set([...capsule.sealedTags, ...entry.tags])].slice(0, MAX_ENTRY_TAGS);
    entry.mood = capsule.sealedMood;
    entry.feelings = capsule.sealedFeelings;
    entry.sealedUntil = null;
    const opened = await entries.save(entry);
    await syncEntryMentions(manager, capsule.userId, [opened]);

    await manager.getRepository(TimeCapsule).update(capsule.id, {
      openedAt: now,
      sealedTitle: null,
      sealedContent: null,
      sealedTags: [],
      sealedMood: null,
      sealedFeelings: [],
    });
    return opened;
  }

  /**
   * The entries as they were written, for exports and the data download: each sealed entry gets its
   * sealed copy back and keeps `sealedUntil`, so the file can say it is sealed. Others are returned as they are.
   */
  async reveal<T extends Entry>(entries: T[]): Promise<T[]> {
    const sealedIds = entries.filter((entry) => entry.sealedUntil).map((entry) => entry.id);
    if (sealedIds.length === 0) {
      return entries;
    }
    const capsules = await this.capsuleRepository.find({ where: { entryId: In(sealedIds), openedAt: IsNull() } });
    const byEntry = new Map(capsules.map((capsule) => [capsule.entryId, capsule]));
    return entries.map((entry) => {
      const capsule = byEntry.get(entry.id);
      return capsule
        ? {
            ...entry,
            title: capsule.sealedTitle,
            content: capsule.sealedContent ?? '',
            tags: capsule.sealedTags,
            mood: capsule.sealedMood,
            feelings: capsule.sealedFeelings,
          }
        : entry;
    });
  }

  /** The writer's capsules opened in the last week, newest first, with their live entries, in one diary or all. */
  async findRecentlyOpened(userId: number, diaryId: number | undefined, now = new Date()): Promise<TimeCapsule[]> {
    const qb = this.capsuleRepository
      .createQueryBuilder('tc')
      .innerJoinAndSelect('tc.entry', 'e', 'e.deleted_at IS NULL')
      .leftJoinAndSelect('e.diary', 'd')
      .where('tc.user_id = :userId', { userId })
      .andWhere('tc.opened_at >= :since', { since: new Date(now.getTime() - OPENED_CAPSULE_HIGHLIGHT_DAYS * DAY_MS) })
      .orderBy('tc.opened_at', 'DESC')
      .limit(OPENED_CAPSULE_HIGHLIGHT_LIMIT);
    if (diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId });
    }
    return qb.getMany();
  }
}

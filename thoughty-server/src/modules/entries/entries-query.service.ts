import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, EntryRevision } from '@/database/entities';
import {
  GetHighlightsQueryDto,
  EntryHighlightsResponseDto,
  EntryResponseDto,
} from './dto';
import { toEntryResponse } from './entry-response.mapper';
import { dayParts, writersDayOr } from '@/common/utils';
import { ENTRY_WORDS_SQL } from '@/modules/stats/stats-sql';
import { TimeCapsuleService } from '@/modules/time-capsules/time-capsules.service';
import { RereadReminderService } from '@/modules/reread-reminders/reread-reminders.service';
import { PersonDatesService } from '@/modules/people/person-dates.service';

/** Entries "On this day" shows at most. */
export const ON_THIS_DAY_LIMIT = 10;

export interface OnThisDayQuery {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  diaryId?: number | null;
  limit?: number;
}

export interface OnThisDayEntry {
  entry: Entry;
  yearsAgo: number;
}

export interface MonthMemoryQuery {
  /** The year whose month is being looked back on; only earlier years count. */
  year: number;
  /** 1 to 12. */
  month: number;
  diaryId?: number | null;
}

/**
 * Reading the journal: the days with entries, tag usage, the day's highlights and an entry's revisions.
 * The entry list is `EntryListService`; finding a single entry is `EntryLookupService`.
 */
@Injectable()
export class EntriesQueryService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(EntryRevision)
    private readonly revisionRepository: Repository<EntryRevision>,
    private readonly timeCapsules: TimeCapsuleService,
    private readonly rereadReminders: RereadReminderService,
    private readonly personDates: PersonDatesService,
  ) {}

  async getTagUsage(userId: number): Promise<{ tags: Array<{ tag: string; count: number }> }> {
    const rows: Array<{ tag: string; count: number | string }> = await this.entryRepository.query(
      `SELECT t.tag AS tag, COUNT(*)::int AS count
         FROM entries e
         CROSS JOIN LATERAL UNNEST(e.tags) AS t(tag)
        WHERE e.user_id = $1 AND e.deleted_at IS NULL
        GROUP BY t.tag
        ORDER BY t.tag`,
      [userId],
    );

    return { tags: rows.map(({ tag, count }) => ({ tag, count: Number(count) })) };
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

  /**
   * Highlights on the writer's own day (`query.today`, else the UTC day): a random entry, On This Day,
   * the time capsules opened in the last week, the reread reminders due and the birthdays and anniversaries.
   */
  async getHighlights(userId: number, query: GetHighlightsQueryDto, now = new Date()): Promise<EntryHighlightsResponseDto> {
    const { diaryId } = query;
    const today = writersDayOr(query.today, now);
    const { year, month, day } = dayParts(today);

    let randomQb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.sealed_until IS NULL')
      .orderBy('RANDOM()')
      .limit(1);

    if (diaryId) {
      randomQb = randomQb.andWhere('e.diary_id = :diaryId', { diaryId });
    }

    const [randomEntry, onThisDayEntries, openedCapsules, dueReminders, peopleOfTheDay] = await Promise.all([
      randomQb.getOne(),
      this.findOnThisDay(userId, { year, month, day, diaryId }),
      this.timeCapsules.findRecentlyOpened(userId, diaryId, now),
      this.rereadReminders.findDue(userId, diaryId, today),
      this.personDates.findOn(userId, today),
    ]);

    const onThisDay: Record<number, EntryResponseDto[]> = {};
    for (const { entry, yearsAgo } of onThisDayEntries) {
      onThisDay[yearsAgo] ??= [];
      onThisDay[yearsAgo].push(toEntryResponse(entry));
    }

    return {
      randomEntry: randomEntry ? toEntryResponse(randomEntry) : null,
      onThisDay,
      currentDate: { month: today.slice(5, 7), day: today.slice(8, 10), year },
      openedCapsules: openedCapsules.map((capsule) => ({
        entry: toEntryResponse(capsule.entry),
        sealed_at: capsule.createdAt,
        opened_at: capsule.openedAt!,
        opened_early: capsule.openedAt! < capsule.openAt,
      })),
      rereadReminders: dueReminders.map(toEntryResponse),
      personDates: peopleOfTheDay.map(({ latestEntry, ...person }) => ({
        ...person,
        latestEntry: latestEntry ? toEntryResponse(latestEntry) : null,
      })),
    };
  }

  /**
   * "On this day": the writer's entries from earlier years dated on this month and day, newest first,
   * in one diary or all of them. Entries in the recycle bin and sealed time capsules never count.
   * Highlights and the "On this day" email both read it.
   */
  async findOnThisDay(userId: number, on: OnThisDayQuery): Promise<OnThisDayEntry[]> {
    const mmdd = `${String(on.month).padStart(2, '0')}-${String(on.day).padStart(2, '0')}`;
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .addSelect('EXTRACT(YEAR FROM e.date)', 'entry_year')
      .where('e.user_id = :userId', { userId })
      .andWhere("TO_CHAR(e.date, 'MM-DD') = :mmdd", { mmdd })
      .andWhere('EXTRACT(YEAR FROM e.date) < :currentYear', { currentYear: on.year })
      .andWhere('e.sealed_until IS NULL')
      .orderBy('e.date', 'DESC')
      .limit(on.limit ?? ON_THIS_DAY_LIMIT);

    if (on.diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId: on.diaryId });
    }

    const { entities, raw } = await qb.getRawAndEntities();
    return entities.map((entry, index) => ({
      entry,
      yearsAgo: on.year - Number.parseInt(raw[index].entry_year, 10),
    }));
  }

  /**
   * One memory from this calendar month in an earlier year, picked the same way every time: a favorite
   * first, then the entry with the most words, then the oldest. Archived and empty entries, sealed time
   * capsules and the recycle bin are left out. The monthly recap email reads it.
   */
  async findMonthMemory(userId: number, on: MonthMemoryQuery): Promise<OnThisDayEntry | null> {
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .addSelect('EXTRACT(YEAR FROM e.date)', 'entry_year')
      .addSelect(ENTRY_WORDS_SQL, 'entry_words')
      .where('e.user_id = :userId', { userId })
      .andWhere('EXTRACT(MONTH FROM e.date) = :month', { month: on.month })
      .andWhere('EXTRACT(YEAR FROM e.date) < :year', { year: on.year })
      .andWhere('e.is_archived = FALSE')
      .andWhere('e.sealed_until IS NULL')
      .andWhere("BTRIM(e.content) <> ''")
      .orderBy('e.is_favorite', 'DESC')
      .addOrderBy('entry_words', 'DESC')
      .addOrderBy('e.date', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .limit(1);
    if (on.diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId: on.diaryId });
    }

    const { entities, raw } = await qb.getRawAndEntities<{ entry_year: string }>();
    return entities[0] ? { entry: entities[0], yearsAgo: on.year - Number.parseInt(raw[0].entry_year, 10) } : null;
  }

  async getRevisions(userId: number, entryId: number): Promise<EntryRevision[]> {
    const entry = await this.entryRepository.findOne({
      where: { id: entryId, userId },
    });

    if (!entry) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }
    // A sealed time capsule shows no history until it opens
    if (entry.sealedUntil) {
      return [];
    }

    return this.revisionRepository.find({
      where: { entryId, userId },
      order: { createdAt: 'DESC' },
    });
  }
}

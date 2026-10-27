import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, EntryRevision } from '@/database/entities';
import { GetEntriesQueryDto, GetHighlightsQueryDto, EntriesListResponseDto } from './dto';
import { addSameDayOrder } from '@/common/utils';
import { applyEntryListFilters, parseEntryIdsFilter } from './entry-list-filters';
import { EntrySearchService, type PreparedEntrySearch } from './entry-search.service';

/**
 * Reading the journal: the filtered and searched entry list, the days with entries, tag usage,
 * the day's highlights and an entry's revisions. Finding a single entry is `EntryLookupService`.
 */
@Injectable()
export class EntriesQueryService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(EntryRevision)
    private readonly revisionRepository: Repository<EntryRevision>,
    private readonly entrySearch: EntrySearchService,
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

  async getEntries(userId: number, query: GetEntriesQueryDto): Promise<EntriesListResponseDto> {
    const { search, sort, ids, date, page = 1, limit = 10 } = query;

    const qb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.diary', 'd')
      .leftJoinAndSelect('e.attachments', 'a')
      .where('e.user_id = :userId', { userId });

    const prepared = search ? await this.entrySearch.prepare(search) : null;
    applyEntryListFilters(qb, query, prepared);

    const entryIds = parseEntryIdsFilter(ids);
    if (entryIds.length > 0) {
      qb.addSelect('array_position(CAST(:semanticOrder AS integer[]), e.id)', 'semantic_rank');
      qb.setParameter('semanticOrder', entryIds);
    }

    if (prepared?.kind === 'text') {
      qb.addSelect(this.searchRankExpression(prepared), 'search_rank');
      if (prepared.exactQuery) {
        qb.setParameter('exactQuery', prepared.exactQuery);
      }
    }

    if (date) {
      qb.andWhere('e.date = :date', { date });
    }

    const totalPromise = qb.getCount();

    if (entryIds.length > 0) {
      qb.orderBy('semantic_rank', 'ASC');
    } else if (prepared?.kind === 'text' && sort !== 'date') {
      addSameDayOrder(qb.orderBy('search_rank', 'DESC').addOrderBy('e.date', 'DESC'), 'e');
    } else {
      addSameDayOrder(qb.orderBy('e.isPinned', 'DESC').addOrderBy('e.date', 'DESC'), 'e');
    }
    qb.skip((page - 1) * limit).take(limit);

    const entriesPromise = qb.getMany();
    const tagsPromise = this.entryRepository
      .createQueryBuilder('e')
      .select('DISTINCT UNNEST(e.tags)', 'tag')
      .where('e.user_id = :userId', { userId })
      .getRawMany();

    const [total, entries, tagsResult] = await Promise.all([
      totalPromise,
      entriesPromise,
      tagsPromise,
    ]);

    const searchMatches =
      prepared?.kind === 'text'
        ? await this.entrySearch.findMatches(
            userId,
            entries.map((entry) => entry.id),
            prepared.terms,
          )
        : undefined;

    const allTags = tagsResult
      .map((result) => result.tag)
      .sort((left, right) => left.localeCompare(right));

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        user_id: entry.userId,
        diary_id: entry.diaryId,
        date: entry.date,
        index: entry.index,
        title: entry.title ?? null,
        time_of_day: entry.timeOfDay ?? null,
        mood: entry.mood ?? null,
        feelings: entry.feelings ?? [],
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
          transcript: attachment.transcript ?? undefined,
          transcribed_at: attachment.transcribedAt ?? undefined,
        })),
        ...(searchMatches ? { search_matches: searchMatches.get(entry.id) ?? [] } : {}),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      allTags,
    };
  }

  /**
   * Relevance of an entry to the search: tag matches weigh more than content matches, and
   * ts_rank's normalization 1 keeps long entries from winning by length alone. Entries that
   * hold the last word whole rank above those that only hold a longer word it starts.
   */
  private searchRankExpression(prepared: Extract<PreparedEntrySearch, { kind: 'text' }>): string {
    const matchRank = 'ts_rank(e.search_vector, CAST(:searchQuery AS tsquery), 1)';
    return prepared.exactQuery
      ? `${matchRank} + ts_rank(e.search_vector, CAST(:exactQuery AS tsquery), 1)`
      : matchRank;
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
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }

    return this.revisionRepository.find({
      where: { entryId, userId },
      order: { createdAt: 'DESC' },
    });
  }
}

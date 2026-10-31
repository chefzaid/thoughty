import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { Entry } from '@/database/entities';
import { apiError } from '@/common/errors';
import type { GetRandomEntryQueryDto, RandomEntryResponseDto } from './dto';
import { applyEntryListFilters, entrySearchRank, parseEntryIdsFilter } from './entry-list-filters';
import { EntrySearchService, type PreparedEntrySearch } from './entry-search.service';

/** Each day's order in the journal list: entries without a time first, then by time, then as arranged. */
const SAME_DAY_ORDER = 'e.date DESC, e.time_of_day ASC NULLS FIRST, e.index ASC';

interface PickedRow {
  id: number;
  date: string;
  index: number;
  position: string | number;
}

/**
 * One entry picked at random among those the journal filters match, with the page of the filtered list
 * that shows it, so the journal can open it without leaving the filters.
 *
 * PostgreSQL numbers the matching entries in the list's own order and picks one with `ORDER BY random()
 * LIMIT 1`, so every match is equally likely and only the picked row leaves the database. A writer's
 * journal is thousands of entries at most, which one scan reads in milliseconds; counting first and
 * reading at a random offset would scan the same rows twice and could miss when an entry changes in
 * between. Sealed time capsules keep their place in the numbering, as the list shows them, but are never
 * picked; entries in the recycle bin are left out by the entity's soft delete.
 */
@Injectable()
export class EntryRandomService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly entrySearch: EntrySearchService,
  ) {}

  async pick(userId: number, query: GetRandomEntryQueryDto): Promise<RandomEntryResponseDto> {
    const { search, date, excludeId, limit = 10 } = query;
    const prepared = search ? await this.entrySearch.prepare(search) : null;

    const listed = this.entryRepository
      .createQueryBuilder('e')
      .select('e.id', 'id')
      .addSelect("TO_CHAR(e.date, 'YYYY-MM-DD')", 'date')
      .addSelect('e.index', 'index')
      .addSelect('e.sealed_until IS NOT NULL', 'sealed')
      .where('e.user_id = :userId', { userId });
    applyEntryListFilters(listed, query, prepared);
    if (date) {
      listed.andWhere('e.date = :date', { date });
    }
    listed.addSelect(`ROW_NUMBER() OVER (ORDER BY ${this.listOrder(listed, query, prepared)})`, 'position');

    const picked = this.entryRepository.manager
      .createQueryBuilder()
      .select('listed.id', 'id')
      .addSelect('listed.date', 'date')
      .addSelect('listed.index', 'index')
      .addSelect('listed.position', 'position')
      .from(`(${listed.getQuery()})`, 'listed')
      .where('listed.sealed = false')
      .setParameters(listed.getParameters());
    // The entry picked last time comes back only when nothing else matches
    if (excludeId) {
      picked.orderBy('listed.id = :excludeId', 'ASC').setParameter('excludeId', excludeId).addOrderBy('RANDOM()');
    } else {
      picked.orderBy('RANDOM()');
    }

    const row = await picked.limit(1).getRawOne<PickedRow>();
    if (!row) {
      throw apiError(NotFoundException, 'ENTRY_RANDOM_NO_MATCH');
    }

    return {
      id: Number(row.id),
      date: row.date,
      index: Number(row.index),
      page: Math.floor((Number(row.position) - 1) / limit) + 1,
    };
  }

  /** The journal list's order for this query (`EntriesQueryService.getEntries`), as SQL for the numbering. */
  private listOrder(
    qb: SelectQueryBuilder<Entry>,
    query: GetRandomEntryQueryDto,
    prepared: PreparedEntrySearch | null,
  ): string {
    const entryIds = parseEntryIdsFilter(query.ids);
    if (entryIds.length > 0) {
      qb.setParameter('semanticOrder', entryIds);
      return 'array_position(CAST(:semanticOrder AS integer[]), e.id) ASC';
    }
    if (prepared?.kind === 'text' && query.sort !== 'date') {
      return `${entrySearchRank(qb, prepared)} DESC, ${SAME_DAY_ORDER}`;
    }
    return `e.is_pinned DESC, ${SAME_DAY_ORDER}`;
  }
}
